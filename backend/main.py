
from typing_extensions import TypedDict
from typing import Annotated
import requests
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph.message import add_messages
from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, START, END
from langchain_core.tools import tool
from langgraph.prebuilt import ToolNode, tools_condition
from dotenv import load_dotenv
import os
from flask import Flask, request, jsonify
from flask_cors import CORS


load_dotenv()

app = Flask(__name__)
CORS(app)


GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")
TRIPADVISOR_API_KEY = os.getenv("TRIPADVISOR_API_KEY")
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY")

@tool
def get_place_coordinates(place: str):
    """Get latitude & longitude of a place using Geoapify API"""
    url = f"https://api.geoapify.com/v1/geocode/search?text={place}&apiKey={GEOAPIFY_API_KEY}"
    response = requests.get(url)

    if response.status_code == 200:
        data = response.json()
        if data["features"]:
            coords = data["features"][0]["geometry"]["coordinates"]
            return {
                "place": place,
                "longitude": coords[0],
                "latitude": coords[1],
            }
        return f"No coordinates found for {place}"
    return "Geoapify request failed"

@tool
def get_supermarkets(bbox: str):
    """Get supermarkets within a bounding box using Geoapify Places API"""
    url = f"https://api.geoapify.com/v2/places?categories=commercial.supermarket&filter=rect:{bbox}&limit=10&apiKey={GEOAPIFY_API_KEY}"
    response = requests.get(url)

    if response.status_code == 200:
        data = response.json()
        places = []
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            places.append({
                "name": props.get("name"),
                "address": props.get("formatted"),
                "lat": feature["geometry"]["coordinates"][1],
                "lon": feature["geometry"]["coordinates"][0],
            })
        return places if places else "No supermarkets found in this area."
    return "Geoapify request failed"


@tool
def get_weather(city: str):
    """This tool returns the weather data about the given city"""
    url = f"https://wttr.in/{city}?format=%C+%t"
    response = requests.get(url)
    
    if response.status_code == 200:
        return f"The weather in {city} is {response.text}."

    return "Something went wrong"


def get_tripadvisor_places(city: str):
    """Fetch top places with multiple images from Tripadvisor API"""
    url = f"https://api.content.tripadvisor.com/api/v1/location/search?key={TRIPADVISOR_API_KEY}&searchQuery={city}"
    response = requests.get(url)

    if response.status_code == 200:
        data = response.json()
        if "data" in data and len(data["data"]) > 0:
            places = []
            for p in data["data"][:5]:
                place_id = p.get("location_id")

                # Fetch multiple photos for each place
                photo_url = f"https://api.content.tripadvisor.com/api/v1/location/{place_id}/photos?key={TRIPADVISOR_API_KEY}"
                photo_res = requests.get(photo_url)

                photos = []
                if photo_res.status_code == 200:
                    photo_data = photo_res.json()
                    # Get first 3 large images
                    for ph in photo_data[:3]:
                        photos.append(ph["images"]["large"]["url"])

                places.append({
                    "name": p["name"],
                    "location_id": place_id,
                    "photos": photos  # multiple photos as list
                })

            return {"city": city, "top_places": places}

        return f"No places found for {city}"
    return "Tripadvisor request failed"


@tool
def get_place_photo(query: str):
    """Fetch multiple photo URLs for a place using Unsplash API"""
    url = f"https://api.unsplash.com/search/photos?query={query}&client_id={UNSPLASH_ACCESS_KEY}&per_page=3"
    response = requests.get(url)

    if response.status_code == 200:
        data = response.json()
        if data["results"]:
            return {
                "place": query,
                "photo_urls": [r["urls"]["regular"] for r in data["results"][:3]]
            }
        return {"place": query, "photo_urls": []}
    return {"error": "Unsplash request failed"}


tools = [get_weather,get_place_coordinates,get_supermarkets,get_tripadvisor_places,get_place_photo]

class State(TypedDict):
    messages: Annotated[list, add_messages]


llm = init_chat_model(
    model_provider="google_genai",
    model="gemini-2.5-flash",
    api_key="AIzaSyCbFEcRDAaUytOwLG4CHGC82r6ud9SLP5w",
)



# tools ke sath LLM
llm_with_api_tools = llm.bind_tools(tools)

def chatbot(state: State):
    # yahan galti thi
    message = llm_with_api_tools.invoke(state["messages"])
    return {"messages": [message]}


tool_node = ToolNode(tools=tools)

graph_builder = StateGraph(State)

graph_builder.add_node("chatbot", chatbot)
graph_builder.add_node("tools", tool_node)

graph_builder.add_conditional_edges(
    "chatbot",
    tools_condition,
    {
        "tools": "tools",
        "__end__": END
    }
)


graph_builder.add_edge(START,"chatbot")
graph_builder.add_edge("tools","chatbot")

graph = graph_builder.compile()


SYSTEM_PROMPT = """
You are WanderSync, a premium AI-powered travel assistant.
Your job is to design VIP-quality travel itineraries that feel elegant, professional, and user-friendly.

🛠️ Core Rules

API Usage:
- Use external APIs (OpenAI, TripAdvisor, Geoapify, Weather, Unsplash) only once per query.
- Always fetch at least one relevant **photo link** per attraction, place, or hotel (from Tripadvisor or Unsplash).
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

✈️ Travel Intro – A warm, elegant welcome tailored to the trip theme.  
🌦️ Weather Update – Concise forecast (temperature, season, and what to expect).  
🏛️ Top Attractions – Handpicked highlights with short descriptors.  
   - For each attraction include **up to 3 photo links**.
📅 Day-wise Itinerary – Clear, logical daily breakdown (Day 1, Day 2…).  
   - Include **image links** of key locations or activities.  
🏨 Hotels (3 tiers) – Budget, Mid-range, Luxury (name + short note).  
   - Add **one photo link** for each hotel tier.  
🚖 Transport Tips – Local commuting tips (metro, taxis, passes, apps).  
🛒 Extras – Food recommendations, events, local markets, or cultural add-ons.  
   - If possible, add a **food/market photo link**.  
💰 Budget Estimate – Break down approximate costs for:  
   - Flights ✈️  
   - Hotels 🏨  
   - Transport 🚖  
   - Food 🍴  
   - Activities 🎟️  
   Show **per person cost** (where relevant), then add a **Total Estimated Cost** at the end.

🎨 Formatting Rules
- Use icons + bold headers for each section.
- Always display photo links in markdown format:  
  Example: Eiffel Tower 🌆 – ![View](https://images.unsplash.com/...)  
- Keep text compact, not bulky – avoid walls of text.
- Prioritize clarity & readability over detail overload.
- Ensure flow feels natural (Intro → Weather → Attractions → Itinerary → Hotels → Transport → Extras → Budget).

🏆 Examples of Tone

Dubai (3 days, shopping + beach):
✈️ Welcome aboard your 3-day Dubai escape!  
🌦️ Weather: Sunny, avg 35°C.  
🏛️ Attractions:  
- Jumeirah Beach 🏖️ ![Photo](https://images.unsplash.com/abc123)  
- Dubai Mall 🛍️ ![Photo](https://images.unsplash.com/xyz456)  
- Burj Khalifa 🌆 ![Photo](https://images.unsplash.com/def789)  

📅 Day 1 – Beach + Marina Walk … (Photo link)  
🏨 Hotels … (with photos)  
💰 Budget: Flights $400 + Hotels $300 + Food $150 + Transport $100 + Activities $200 = **$1,150 total**  

Italy (5 days, museums):
✈️ Your 5-day Italian art journey awaits!  
🌦️ Weather: Mild 22–25°C.  
🏛️ Attractions:  
- Vatican Museums ![Photo](https://images.unsplash.com/vatican123)  
- Uffizi Gallery ![Photo](https://images.unsplash.com/uffizi456)  
- Colosseum ![Photo](https://images.unsplash.com/colosseum789)  
📅 Day 1 – Rome: Colosseum + Trevi Fountain … (Photo link)  
💰 Budget: Flights $500 + Hotels $400 + Food $250 + Transport $120 + Activities $180 = **$1,450 total**  

"""



@app.route("/chat", methods=["POST"])
def chat():
    user_data = request.get_json()
    query = user_data.get("query", "")

    state = State(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": query}
        ]
    )

    final_response = ""
    for event in graph.stream(state, stream_mode="values"):
        if "messages" in event:
            final_response = event["messages"][-1].content

    return jsonify({"response": final_response})

if __name__ == "__main__":
    app.run(port=5000, debug=True)           