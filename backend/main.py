from typing_extensions import TypedDict
from typing import Annotated
import requests
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph.message import add_messages
from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, START, END
from langchain_core.tools import tool
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_text_splitters import RecursiveCharacterTextSplitter  # type:ignore
from langchain_google_genai import GoogleGenerativeAIEmbeddings  # type:ignore
from langchain_qdrant import QdrantVectorStore  # type:ignore
from qdrant_client import QdrantClient
from langchain_community.vectorstores import Qdrant
from qdrant_client.http import models
from sentence_transformers import SentenceTransformer
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv
import asyncio
import re, os, jwt, requests
import uuid
from flask import Flask, request, jsonify, send_from_directory,session
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime,timedelta
from flask_session import Session
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
from flask_jwt_extended import jwt_required, get_jwt_identity



load_dotenv()

os.environ["GOOGLE_API_KEY"] = "AIzaSyAUhP4Wn6lFRhoigZCBHaheMR24a8ioxvA"

# MongoDB setup
client = MongoClient("mongodb://localhost:27017/")
db = client["wandersync"]

# Existing collection
chat_collection = db["chat_history"]

# New collection for users
users_collection = db["users"]

app = Flask(__name__, static_folder="static")
CORS(app)

app.secret_key = os.getenv("SECRET_KEY", "supersecretkey")
app.config["SESSION_TYPE"] = "filesystem"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=2)
Session(app)

JWT_SECRET = os.getenv("JWT_SECRET", "jwtsecretkey")
# API Keys
GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")
TRIPADVISOR_API_KEY = os.getenv("TRIPADVISOR_API_KEY")
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY")
PIXABAY_API_KEY = os.getenv("PIXABAY_API_KEY") 
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")

embedding_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# --- Tools ---
@tool
def normal_question(query: str):
    """Answer only website-related queries"""
    return f"Website query received: {query}"

@tool
def search_wandersync(query: str):
    """Semantic search in wandersync collection to retrieve past query-response pairs"""
    try:
        vectorstore = Qdrant.from_existing_collection(
            collection_name="wandersync",
            embedding=embedding_model,
            url="http://localhost:6333"
        )
        docs = vectorstore.similarity_search(query, k=3)
        results = []
        for doc in docs:
            results.append({
                "query": doc.metadata.get("query"),
                "response": doc.metadata.get("response")
            })
        return results if results else "No similar results found."
    except Exception as e:
        return f"Error while searching: {str(e)}"

@tool
def get_place_coordinates(place: str):
    """Get latitude & longitude of a place using Geoapify API"""
    url = f"https://api.geoapify.com/v1/geocode/search?text={place}&apiKey={GEOAPIFY_API_KEY}"
    res = requests.get(url)
    if res.status_code == 200:
        data = res.json()
        if data["features"]:
            coords = data["features"][0]["geometry"]["coordinates"]
            return {"place": place, "longitude": coords[0], "latitude": coords[1]}
        return f"No coordinates found for {place}"
    return "Geoapify request failed"

@tool
def get_supermarkets(bbox: str):
    """Get a list of supermarkets within a bounding box using Geoapify API"""
    url = f"https://api.geoapify.com/v2/places?categories=commercial.supermarket&filter=rect:{bbox}&limit=10&apiKey={GEOAPIFY_API_KEY}"
    res = requests.get(url)
    if res.status_code == 200:
        data = res.json()
        places = []
        for f in data.get("features", []):
            props = f.get("properties", {})
            places.append({
                "name": props.get("name"),
                "address": props.get("formatted"),
                "lat": f["geometry"]["coordinates"][1],
                "lon": f["geometry"]["coordinates"][0],
            })
        return places if places else "No supermarkets found in this area."
    return "Geoapify request failed"

@tool
def get_weather(city: str):
    """Get weather from wttr.in"""
    res = requests.get(f"https://wttr.in/{city}?format=%C+%t")
    if res.status_code == 200:
        return f"The weather in {city} is {res.text}."
    return "Something went wrong"

@tool
def get_tripadvisor_places(city: str):
    """Fetch top 5 places in the given city from Tripadvisor with up to 3 photos each."""
    url = f"https://api.content.tripadvisor.com/api/v1/location/search?key={TRIPADVISOR_API_KEY}&searchQuery={city}"
    res = requests.get(url)
    if res.status_code == 200:
        data = res.json()
        if "data" in data and len(data["data"]) > 0:
            places = []
            for p in data["data"][:5]:
                pid = p.get("location_id")
                photo_url = f"https://api.content.tripadvisor.com/api/v1/location/{pid}/photos?key={TRIPADVISOR_API_KEY}"
                photo_res = requests.get(photo_url)
                photos = []
                if photo_res.status_code == 200:
                    for ph in photo_res.json()[:3]:
                        photos.append(ph["images"]["large"]["url"])
                places.append({"name": p["name"], "location_id": pid, "photos": photos})
            return {"city": city, "top_places": places}
        return f"No places found for {city}"
    return "Tripadvisor request failed"

@tool
def get_place_photo(query: str):
    """Fetch up to 3 photo URLs for a given place from Unsplash."""
    url = f"https://api.unsplash.com/search/photos?query={query}&client_id={UNSPLASH_ACCESS_KEY}&per_page=3"
    res = requests.get(url)
    if res.status_code == 200:
        data = res.json()
        if data["results"]:
            return {"place": query, "photo_urls": [r["urls"]["regular"] for r in data["results"][:3]]}
        return {"place": query, "photo_urls": []}
    return {"error": "Unsplash request failed"}

@tool
def get_pixabay_photos(query: str):
    """Fetch up to 3 photo URLs for a given query from Pixabay."""
    url = f"https://pixabay.com/api/?key={PIXABAY_API_KEY}&q={query}&image_type=photo"
    res = requests.get(url)
    if res.status_code == 200:
        data = res.json()
        if data["hits"]:
            return {"query": query, "photo_urls": [hit["webformatURL"] for hit in data["hits"][:3]]}
        return {"query": query, "photo_urls": []}
    return {"error": "Pixabay request failed"}

@tool
def get_pixabay_videos(query: str):
    """Fetch up to 3 video URLs for a given query from Pixabay."""
    url = f"https://pixabay.com/api/videos/?key={PIXABAY_API_KEY}&q={query}"
    res = requests.get(url)
    if res.status_code == 200:
        data = res.json()
        if data["hits"]:
            return {"query": query, "video_urls": [hit["videos"]["medium"]["url"] for hit in data["hits"][:3]]}
        return {"query": query, "video_urls": []}
    return {"error": "Pixabay request failed"}

@tool
def get_pexels_photos(query: str):
    """Fetch up to 3 photo URLs for a given query from Pexels."""
    url = f"https://api.pexels.com/v1/search?query={query}&per_page=3"
    headers = {"Authorization": PEXELS_API_KEY}
    res = requests.get(url, headers=headers)
    if res.status_code == 200:
        data = res.json()
        if data["photos"]:
            return {"query": query, "photo_urls": [p["src"]["medium"] for p in data["photos"][:3]]}
        return {"query": query, "photo_urls": []}
    return {"error": "Pexels request failed"}

@tool
def get_pexels_videos(query: str):
    """Fetch up to 3 video URLs for a given query from Pexels."""
    url = f"https://api.pexels.com/videos/search?query={query}&per_page=3"
    headers = {"Authorization": PEXELS_API_KEY}
    res = requests.get(url, headers=headers)
    if res.status_code == 200:
        data = res.json()
        if data["videos"]:
            return {"query": query, "video_urls": [v["video_files"][0]["link"] for v in data["videos"][:3]]}
        return {"query": query, "video_urls": []}
    return {"error": "Pexels request failed"}

# --- Tools list ---
tools = [
    normal_question, search_wandersync,
    get_weather, get_place_coordinates, get_supermarkets,
    get_tripadvisor_places, get_place_photo,
    get_pixabay_photos, get_pixabay_videos,
    get_pexels_photos, get_pexels_videos
]

# --- State & Graph ---
class State(TypedDict):
    messages: Annotated[list, add_messages]

llm = init_chat_model(
    model_provider="google_genai",
    model="gemini-2.5-flash",
    api_key="AIzaSyCbFEcRDAaUytOwLG4CHGC82r6ud9SLP5w",
)
llm_with_api_tools = llm.bind_tools(tools)

def chatbot(state: State):
    message = llm_with_api_tools.invoke(state["messages"])
    return {"messages": [message]}

tool_node = ToolNode(tools=tools)
graph_builder = StateGraph(State)
graph_builder.add_node("chatbot", chatbot)
graph_builder.add_node("tools", tool_node)
graph_builder.add_conditional_edges("chatbot", tools_condition, {"tools": "tools", "__end__": END})
graph_builder.add_edge(START, "chatbot")
graph_builder.add_edge("tools", "chatbot")
graph = graph_builder.compile()


SYSTEM_PROMPT = """
You are WanderSync, a premium AI-powered travel assistant.
Your job is to design VIP-quality travel itineraries that feel elegant, professional, and user-friendly.

🛠️ Core Behavior
- Only answer queries related to travel, trips, itineraries, hotels, attractions, weather, transport, or data available in the `wandersync` collection.
- If the user asks unrelated things (e.g., “What is the capital of India?”), strictly reply:
  👉 "are you mad I'm only response according to traveling trip"
- Use the provided tools:
  - `search_wandersync` → Retrieve past query-response pairs from stored vectors (only relevant matches).
  - `normal_question` → Handle general website-related queries (non-vector).
  - `get_place_coordinates`, `get_weather`, `get_supermarkets`, `get_tripadvisor_places`, `get_place_photo`, `get_pixabay_photos`, `get_pixabay_videos`, `get_pexels_photos`, `get_pexels_videos` → Use for real travel data.

📑 Response Structure (Mandatory for Itineraries)
- ✈️ Travel Intro – Polished welcome to the trip.
- 🌦️ Weather Update – Forecast summary.
- 🏛️ Top Attractions – Highlights with 1–3 photos, 1–2 videos if available.
- 📅 Day-wise Itinerary – Clear day breakdown, add media where possible.
- 🏨 Hotels – Budget, Mid-range, Luxury with 1 photo each.
- 🚖 Transport Tips – Practical commuting info.
- 🛒 Extras – Food, events, cultural add-ons (add 1 photo if possible).
- 💰 Budget Estimate – Flights, Hotels, Transport, Food, Activities → show per person + total.

🛠️ Core Rules
API Usage:
- Use external APIs (OpenAI, TripAdvisor, Geoapify, Weather, Unsplash, Pixabay, Pexels) only once per query.
- Fetch **3–5 photo links** in total per query from any combination of image tools (Unsplash, Pixabay, Pexels, TripAdvisor).
- Fetch **2–3 video links** in total per query from any 2 video tools (Pixabay or Pexels).
- Always include **at least one photo per attraction, hotel, or market**.
- Cache results internally for reuse in the same response.

Refinement Loop:
- Keep rewriting and polishing internally until the itinerary is clear, structured, and travel-agent quality.
- No half-done drafts — only final, polished responses.

Language & Tone:
- Always deliver in English, regardless of user input.
- Tone: Elegant, concise, premium, professional.
- Style: Mix of icons + crisp text for clarity.

📑 Response Structure (Always Mandatory)
Each response must include the following sections, in order:

✈️ Travel Intro – Warm, elegant welcome tailored to the trip theme.  
🌦️ Weather Update – Concise forecast (temperature, season, what to expect).  
🏛️ Top Attractions – Handpicked highlights with short descriptors.  
   - Include **up to 3 photo links per attraction**.  
   - If available, include **1–2 video links** per attraction.  
📅 Day-wise Itinerary – Clear daily breakdown (Day 1, Day 2…).  
   - Include **image links** of key locations or activities.  
🏨 Hotels (3 tiers) – Budget, Mid-range, Luxury (name + short note).  
   - Add **one photo link** per hotel tier.  
🚖 Transport Tips – Local commuting tips (metro, taxis, passes, apps).  
🛒 Extras – Food, events, local markets, cultural add-ons.  
   - Include **1 photo** if possible.  
💰 Budget Estimate – Approximate costs for:  
   - Flights ✈️  
   - Hotels 🏨  
   - Transport 🚖  
   - Food 🍴  
   - Activities 🎟️  
   Show **per person cost** and **Total Estimated Cost**.

🎨 Formatting Rules
- Use icons + bold headers for each section.
- Display media links in markdown format.
- Limit to **3–5 images total** and **2–3 videos total** per itinerary.
- Keep text compact – avoid walls of text.
- Prioritize clarity & readability over detail overload.
- Ensure natural flow: Intro → Weather → Attractions → Itinerary → Hotels → Transport → Extras → Budget.

🏆 Example Usage
Dubai (3 days, shopping + beach):
✈️ Welcome aboard your 3-day Dubai escape!  
🌦️ Weather: Sunny, avg 35°C.  
🏛️ Attractions:  
- Jumeirah Beach 🏖️ ![Photo](https://images.unsplash.com/abc123) ![Video](https://www.pexels.com/video1)  
- Dubai Mall 🛍️ ![Photo](https://images.unsplash.com/xyz456)  
- Burj Khalifa 🌆 ![Photo](https://images.unsplash.com/def789)  

📅 Day 1 – Beach + Marina Walk … (Photo link)  
🏨 Hotels … (with photos)  
💰 Budget: Flights $400 + Hotels $300 + Food $150 + Transport $100 + Activities $200 = **$1,150 total**

🧠 Special Rules
- `search_wandersync` must return **only relevant past responses** and be incorporated naturally.
- `normal_question` answers must align with website purpose, but only when non-travel-related.
- Never dump full database; always filter for relevance.
"""



# --- Flask Routes ---




# --- Helper Functions ---
def is_valid_email(email):
    pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return re.match(pattern, email) is not None

def generate_jwt(user_id):
    payload = {"user_id": str(user_id), "exp": datetime.utcnow() + timedelta(hours=2)}
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return token

def verify_jwt(token):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# --- Registration Route ---
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({"success": False, "message": "Name, email, and password are required."}), 400

    if not is_valid_email(email):
        return jsonify({"success": False, "message": "Invalid email format."}), 400

    if users_collection.find_one({"email": email}):
        return jsonify({"success": False, "message": "Email already registered."}), 400

    hashed_password = generate_password_hash(password)

    user_doc = {
        "name": name,
        "email": email,
        "password": hashed_password,
        "created_at": datetime.utcnow()
    }

    users_collection.insert_one(user_doc)
    return jsonify({"success": True, "message": "Registration successful."})

# --- Login Route ---
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required."}), 400

    user = users_collection.find_one({"email": email})
    if not user or not check_password_hash(user["password"], password):
        return jsonify({"success": False, "message": "Invalid email or password."}), 401

    # Store user ID in session
    session["user_id"] = str(user["_id"])
    session.permanent = True  # use PERMANENT_SESSION_LIFETIME

    # Optional JWT token
    token = generate_jwt(user["_id"])

    return jsonify({"success": True, "message": "Login successful.", "jwt": token})

# --- Logout Route ---
@app.route("/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"success": True, "message": "Logged out successfully."})

# --- Protected Route Example ---

@app.route("/profile", methods=["GET"])
def profile():
    user_id = session.get("user_id")

    jwt_token = request.headers.get("Authorization")
    if jwt_token:
        jwt_token = jwt_token.replace("Bearer ", "")
        user_id_from_jwt = verify_jwt(jwt_token)
        if user_id_from_jwt:
            user_id = user_id_from_jwt

    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)}, {"password": 0})
    except Exception:
        return jsonify({"success": False, "message": "Invalid user ID"}), 400

    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    return jsonify({"success": True, "user": {"name": user["name"], "email": user["email"]}})



local_embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
collection_name = "wandersync"
client = QdrantClient(url="http://localhost:6333")

def ensure_collection():
    try:
        col = client.get_collection(collection_name)
        if col.config.params.vectors.size != 384:
            client.recreate_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE),
            )
    except:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE),
        )

@app.route("/chat", methods=["POST"])
def chat():
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())

    user_data = request.get_json()
    query = user_data.get("query", "")

    state = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": query}
        ]
    }

    final_response = ""
    for event in graph.stream(state, stream_mode="values"):
        messages = event.get("messages", [])
        if messages:
            final_response = messages[-1].content

    chat_collection.insert_one({
        "query": query,
        "response": final_response,
        "timestamp": datetime.utcnow()
    })

    ensure_collection()

    vector = local_embedding_model.encode(f"{final_response}").tolist()

    client.upsert(
        collection_name=collection_name,
        points=[models.PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "query": query,
                "response": final_response,
                "timestamp": datetime.utcnow().isoformat()
            }
        )]
    )

    return jsonify({"response": final_response})



client = QdrantClient(url="http://localhost:6333")
collection_name = "wandersync"
embedding_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

@app.route("/search", methods=["POST"])
def search():
    user_data = request.get_json()
    query = user_data.get("query", "").strip()

    if not query:
        return jsonify({"error": "Query is required"}), 400

    query_vector = embedding_model.embed_query(query)  # get query embedding

    search_result = client.search(
        collection_name=collection_name,
        query_vector=query_vector,
        limit=5  # get top 5 most similar
    )

    results = []
    for hit in search_result:
        response_text = hit.payload.get("response")
        if response_text:  # only include hits with a response
            results.append({
                "id": hit.id,
                "score": hit.score,
                "response": response_text
            })

    if not results:
        return jsonify({"results": [], "message": "No relevant answers found."}), 200

    return jsonify({"results": results}), 200




@app.route("/history", methods=["GET"])
def get_history():
    history = list(chat_collection.find({}, {"_id": 0}).sort("timestamp", 1).limit(50))
    return jsonify({"history": history})

@app.route("/static/<path:path>")
def serve_static(path):
    return send_from_directory("static", path)

if __name__ == "__main__":
    app.run(port=5000, debug=True)
