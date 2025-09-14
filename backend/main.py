from typing_extensions import TypedDict
from typing import Annotated
import requests
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
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
from langchain_community.embeddings import HuggingFaceEmbeddings  # choose only one
from dotenv import load_dotenv
import asyncio
import re, os, jwt
import uuid
import tempfile
import whisper
from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime, timedelta
from flask_session import Session
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
from flask_jwt_extended import jwt_required, get_jwt_identity


from dotenv import load_dotenv
load_dotenv()

# --- Flask App ---
app = Flask(__name__, static_folder="static")
CORS(app)
app.secret_key = os.getenv("SECRET_KEY", "supersecretkey")
app.config["SESSION_TYPE"] = "filesystem"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=2)
Session(app)

JWT_SECRET = os.getenv("JWT_SECRET", "jwtsecretkey")

# --- MongoDB Setup ---
mongo_uri = os.getenv("MONGODB_URI")
client_mongo = MongoClient(mongo_uri)
db = client_mongo["wandersync"]
chat_collection = db["chat_history"]
users_collection = db["users"]

# --- Embeddings & Qdrant Setup ---
embedding_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
local_embedding_model = embedding_model  # reuse for vector insert

client = QdrantClient(
    host=os.getenv("QDRANT_HOST"),
    api_key=os.getenv("QDRANT_API_KEY")
)
collection_name = "wandersync"

def ensure_qdrant_collection():
    try:
        col = client.get_collection(collection_name)
        if col.config.params.vectors.size != 384:
            client.recreate_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE),
            )
    except Exception:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE),
        )

# --- Whisper Model ---
whisper_model = whisper.load_model("small")

GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")
TRIPADVISOR_API_KEY = os.getenv("TRIPADVISOR_API_KEY")
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY")
PIXABAY_API_KEY = os.getenv("PIXABAY_API_KEY") 
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")
SERP_API_KEY = os.getenv("SERP_API_KEY")


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



@tool
def search_from_google(query: str):
    """
    Search Google via SERP API specifically for travel-related queries 
    (hotels, flights, trips, etc.) and return top organic results as markdown links.
    """
    travel_query = f"{query} travel OR flights OR hotels"
    
    try:
        serp_response = requests.get(
            "https://serpapi.com/search",
            params={
                "engine": "google",
                "q": travel_query,
                "api_key": SERP_API_KEY,
                "gl": "us",
                "hl": "en"
            }
        ).json()
    except Exception as e:
        return {"query": query, "response": f"Error fetching results: {str(e)}"}

    links = []
    for item in serp_response.get("organic_results", []):
        title = item.get("title")
        link = item.get("link")
        if title and link:
            links.append(f"[{title}]({link})")

    if links:
        return {
            "query": query,
            "response": "Here are the top travel-related Google search results:\n" + "\n".join(links)
        }
    else:
        return {"query": query, "response": "No travel results found on Google."}

# --- Tools list ---
tools = [
    normal_question, search_wandersync,
    get_weather, get_place_coordinates, get_supermarkets,
    get_tripadvisor_places, get_place_photo,
    get_pixabay_photos, get_pixabay_videos,
    get_pexels_photos, get_pexels_videos,
    search_from_google
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
You are WanderSync, a **premium AI travel assistant**. 
Your mission: create **VIP-quality, elegant, human-like itineraries** tailored to user requests.

🛠️ Core Behavior
- Answer **only travel-related queries**: flights, trips, hotels, transport, attractions, weather.
- Include **practical info**: travel tips, local insights, transport options, cultural tips, and budget guidance.
- If info is missing (flights, transport), provide **clickable links via Google SERP**.
- Tools available: search_wandersync, normal_question, get_place_coordinates, get_weather, get_tripadvisor_places, get_pixabay_photos, get_pixabay_videos, get_pexels_photos, get_pexels_videos.
- Responses must feel **human, detailed, elegant, and premium**.
- **Include images and videos only if they are available.** If no media is found, omit them instead of leaving placeholders.

🎯 Few-Shot Example (Always emulate this format):

**User:** Plan 3 days in Dubai for shopping + beach.  
**WanderSync:**  
✈️ **Travel Intro:** Welcome aboard your 3-day Dubai escape! Sun, sand, and luxury await.  

🌦️ **Weather Update:** Sunny, avg 35°C. Light breezes.  

🏛️ **Top Attractions:**  
- **Jumeirah Beach** 🏖️ ![Photo](https://images.unsplash.com/abc123) ![Video](https://www.pexels.com/video1)  
- **Dubai Mall** 🛍️ ![Photo](https://images.unsplash.com/xyz456)  
- **Burj Khalifa** 🌆  *(no media available)*  

📅 **Day-wise Itinerary:**  
- Day 1 – Beach + Marina Walk ![Photo](https://images.unsplash.com/day1)  
- Day 2 – Mall + Desert Safari ![Photo](https://images.unsplash.com/day2)  
- Day 3 – City Tour + Souks *(no media available)*  

🏨 **Hotels (3 tiers):**  
- Budget: XYZ Hotel ![Photo](https://images.unsplash.com/budget)  
- Mid-range: ABC Hotel *(no media available)*  
- Luxury: Luxury Resort ![Photo](https://images.unsplash.com/luxury)  

🚖 **Transport Tips:** Metro passes, taxi apps, Uber availability, parking info.  

🛒 **Extras:** Gold Souk, Dubai Fountain show, local markets ![Photo](https://images.unsplash.com/extra)  

💰 **Budget Estimate:** Flights $400 + Hotels $300 + Food $150 + Transport $100 + Activities $200 = **$1,150 total**

📑 Response Structure Rules
1. ✈️ Travel Intro  
2. 🌦️ Weather Update  
3. 🏛️ Top Attractions (include **all available images & videos**, omit if none)  
4. 📅 Day-wise Itinerary (include **all relevant media**, omit if none)  
5. 🏨 Hotels (Budget, Mid, Luxury – include all photos available)  
6. 🚖 Transport Tips  
7. 🛒 Extras (include all relevant media if possible)  
8. 💰 Budget Estimate (per person + total)  

🎨 Formatting Rules
- Use **icons + bold headers**  
- Markdown for all media links  
- Include **only available images/videos**  
- Keep **concise, readable, travel-agent quality**  
- Always **polish internally** before sending  

🧠 API & Tool Usage
- Call external APIs for images/videos: Unsplash, Pixabay, Pexels, TripAdvisor.  
- Fetch **all relevant media**, but **omit empty or missing media**.  
- Cache internally for reuse in the response.  

💡 Language & Tone
- Always **English**, elegant, professional  
- Mix **icons + crisp text** for clarity  
- Flow: Intro → Weather → Attractions → Itinerary → Hotels → Transport → Extras → Budget  

🔗 Special Rules
- `search_wandersync` returns only **relevant past responses**  
- `normal_question` answers align only when non-travel-related  
- Never dump full database, **filter for relevance**
- **Always produce the itinerary as a human travel agent would**, including media only when available.
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
    user_id = str(user["_id"])
    # Optional JWT token
    token = generate_jwt(user["_id"])

    return jsonify({"success": True, "message": "Login successful.", "jwt": token,"user_id":user_id})

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



def ensure_collection():
    try:
        col = client.get_collection(collection_name)
        if col.config.params.vectors.size != 384:
            client.recreate_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE),
            )
    except Exception:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE),
        )



@app.route("/chat", methods=["POST"])
def chat():
    try:
        # Ensure asyncio loop exists
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            asyncio.set_event_loop(asyncio.new_event_loop())

        query = ""
        user_id = None

        # --- Audio case ---
        if "audio" in request.files:
            audio_file = request.files["audio"]
            temp_dir = tempfile.gettempdir()
            input_path = os.path.join(temp_dir, f"{uuid.uuid4()}.webm")
            audio_file.save(input_path)

            # Whisper: transcribe to English text
            try:
                result = whisper_model.transcribe(
                    input_path,
                    task="translate",  # ya "transcribe" agar sirf text chahiye
                    language="en"
                )
                query = result.get("text", "")
            except Exception as e:
                return jsonify({"error": f"Audio transcription failed: {str(e)}"}), 500
            finally:
                # Cleanup temp file
                if os.path.exists(input_path):
                    os.remove(input_path)

            user_id = request.form.get("user_id")

        # --- Text case ---
        else:
            user_data = request.get_json()
            query = user_data.get("query", "")
            user_id = user_data.get("user_id")

        if not query:
            return jsonify({"error": "No query provided"}), 400

        # --- Chat logic ---
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

        # --- Save chat in Mongo ---
        chat_collection.insert_one({
            "user_id": user_id,
            "query": query,
            "response": final_response,
            "timestamp": datetime.utcnow()
        })

        # --- Ensure collection exists ---
        ensure_collection()

        # --- Save response in Qdrant ---
        vector = local_embedding_model.encode(final_response).tolist()
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

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    



# Embedding model
embedding_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

@app.route("/search", methods=["POST"])
def search():
    user_data = request.get_json()
    query = user_data.get("query", "").strip()

    if not query:
        return jsonify({"error": "Query is required"}), 400

    # Generate query vector
    query_vector = embedding_model.embed_query(query)

    # Search Qdrant collection
    search_result = client.search(
        collection_name=collection_name,
        query_vector=query_vector,
        limit=5
    )

    results = []
    for hit in search_result:
        response_payload = hit.payload.get("response")
        if response_payload:
            # Convert dict to string if necessary
            if isinstance(response_payload, dict):
                response_text = response_payload.get("answer", str(response_payload))
            else:
                response_text = str(response_payload)

            results.append({
                "id": hit.id,
                "score": hit.score,
                "response": response_text
            })

    if not results:
        return jsonify({"results": [], "message": "No relevant answers found."}), 200

    return jsonify({"results": results}), 200


@app.route("/conversion_chat", methods=["POST"])
def conversion_chat():
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())

    user_data = request.get_json()
    query = user_data.get("query", "").strip()
    if not query:
        return jsonify({"error": "Query is required"}), 400

    # Prepare messages for LLM
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=query)
    ]

    # Get response from LLM
    ai_response = llm(messages)
    final_response = ai_response.content

    return jsonify({"response": final_response})



@app.route("/history", methods=["GET"])
def get_history():
    try:
        user_id = request.args.get("user_id")  # Read query param
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400

        # Fetch only this user's messages
        history = list(
            chat_collection.find({"user_id": user_id}, {"_id": 0}).sort("timestamp", -1).limit(200)
        )
        return jsonify({"history": history})
    except Exception as e:
        return jsonify({"error": str(e)}), 5000


@app.route("/history/<chat_id>", methods=["DELETE"])
def delete_chat(chat_id):
    try:
        result = chat_collection.delete_one({"chat_id": chat_id})
        if result.deleted_count == 1:
            return jsonify({"message": f"Chat {chat_id} deleted successfully"})
        else:
            return jsonify({"error": f"No chat found with id {chat_id}"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    
@app.route("/static/<path:path>")
def serve_static(path):
    return send_from_directory("static", path)

if __name__ == "__main__":
    app.run(port=5000, debug=True)
