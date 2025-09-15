WanderSync: AI-Powered Travel Planning Assistant
WanderSync is an innovative travel planning application that leverages Generative AI (Gen AI) and Large Language Models (LLMs) to simplify the process of interacting with travel-related documents. Users can upload PDFs, ask questions, and receive real-time, contextually relevant responses. Built with a robust tech stack, WanderSync offers personalized trip plans, currency conversion, and downloadable PDF outputs, making travel planning seamless and efficient.
Table of Contents

Project Overview
Features
Tech Stack
Setup Instructions
Prerequisites
Backend Setup
Frontend Setup


Deployment
Links
Test Data
Team

Project Overview
WanderSync addresses the challenge of extracting and querying information from unstructured travel documents, such as itineraries and packages. By using advanced AI technologies like Google Gemini and vector databases, it provides accurate, personalized travel solutions. The application supports PDF uploads, conversational AI, and chat history management, catering to travelers, professionals, and businesses.
Features

PDF Upload and Processing: Upload single or multiple PDFs, with OCR for accurate text extraction.
Conversational AI: Ask questions about travel documents and receive context-aware responses.
Chat History: Store and revisit past interactions.
Downloadable Trip Plans: Export travel plans as PDFs.
Semantic Search: Powered by FAISS and Qdrant for efficient query matching.
Responsive UI: Built with Next.js and Tailwind CSS for a seamless user experience.

Tech Stack

Frontend: Next.js, Tailwind CSS
Backend: Flask (Python), LangGraph
AI Libraries: Google Gemini API (gemini-1.5-pro-latest), LangChain, Whisper
Databases/Storage: MongoDB Atlas, Qdrant, FAISS
Programming/IDE: Python, Jupyter Notebook, Google Colab, Anaconda

Setup Instructions
Prerequisites

Hardware:
Processor: Intel Core i5/i7 or higher
RAM: 8 GB or higher
Storage: 500 GB HDD
Peripherals: Keyboard, Mouse, Color SVGA display


Software:
Python 3.10+
Node.js 16+ (for frontend)
Git
A Google API key for Gemini integration



Backend Setup

Clone the Repository:git clone https://github.com/RajeelSiddiqui1/wanderSync
cd wanderSync/backend


Install Dependencies:pip install -r requirements.txt

Required libraries include google-generativeai, langchain_google_genai, langchain-community, etc.
Set Up Environment Variables:
Create a .env file in the backend folder:GOOGLE_API_KEY=<your_google_api_key>




Run the Backend Server:python server.py

The backend will run on localhost:5000 by default.

Frontend Setup

Navigate to Frontend Folder:cd ../frontend


Install Dependencies:npm install


Run the Frontend Development Server:npm run dev

The frontend will be accessible at http://localhost:3000.

Running the Application

Ensure the backend server is running (python server.py in the backend folder).
Start the frontend (npm run dev in the frontend folder).
Open http://localhost:3000 in your browser to access the WanderSync interface.
Upload PDFs and submit queries via the chatbot interface.

Deployment

Backend: Deploy the Flask backend on platforms like Heroku, AWS, or PythonAnywhere. Follow platform-specific instructions for Flask apps.
Frontend: Deploy the Next.js frontend on Vercel or Netlify. The current deployed frontend is live at https://wander-sync-frontend.vercel.app/chatbot.
Ensure environment variables (e.g., GOOGLE_API_KEY) are configured on the deployment platform.

Links

Deployed Application: https://wander-sync-frontend.vercel.app/chatbot
Blog Post: https://medium.com/@rajeelsiddiqui3/wandersync-revolutionizing-travel-planning-with-generative-ai-95f56de248fe
GitHub Repository: https://github.com/RajeelSiddiqui1/wanderSync

Test Data

Sample PDFs used for testing include:
Travel itineraries
Financial reports
Research papers
eBooks


These files simulate real-world use cases for querying travel packages and details.

Team



Name
Task



Muhammad Rajeel
Build AI with LangChain


Hamza
Backend Development


Muskan Riaz
Backend Development


Antal Hayat
QA and Live Deployment


Umar
Documentation and GitHub


Assumptions

Users have a stable internet connection for accessing the deployed application and API services.
Google API key is required for Gemini integration.
The frontend and backend folders are structured as wanderSync/backend and wanderSync/frontend in the repository.
Sample PDFs for testing are available in the repository or provided by the user.
