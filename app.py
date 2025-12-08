from flask import Flask, request, jsonify, render_template
import google.generativeai as genai
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


def get_best_model():
    """
    Automatically finds the best available Gemini model
    that supports generateContent.
    """
    models = genai.list_models()

    valid_models = []

    for m in models:
        if "generateContent" in m.supported_generation_methods:
            valid_models.append(m.name)

    if not valid_models:
        raise Exception("No Gemini models support generateContent.")

    # Preferred models
    priority = [
        "gemini-2.0-pro",
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash"
    ]

    for p in priority:
        if p in valid_models:
            print(f"✔ Auto-selected model: {p}")
            return p

    # fallback
    print(f"✔ Auto-selected model (fallback): {valid_models[0]}")
    return valid_models[0]


# AUTO PICK MODEL
best_model_name = get_best_model()
model = genai.GenerativeModel(best_model_name)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()
        user_msg = data.get("prompt")

        response = model.generate_content(user_msg)
        reply = response.text

        return jsonify({"reply": reply})

    except Exception as e:
        print("\n===== SERVER ERROR =====")
        print(e)
        print("========================\n")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
