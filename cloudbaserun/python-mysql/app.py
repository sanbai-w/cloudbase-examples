import os
from typing import Any, Dict

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from sqlalchemy.exc import SQLAlchemyError

from db import Counter, SessionLocal, init_db, truncate_or_delete_all


app = Flask(__name__, static_folder=None)
CORS(app)


@app.route("/", methods=["GET"])  # Home page
def index():
    html_path = os.path.join(os.path.dirname(__file__), "index.html")
    return send_file(html_path)


@app.get("/api/count")
def get_count():
    session = SessionLocal()
    try:
        total_count: int = session.query(Counter).count()
        return jsonify({"code": 0, "data": total_count})
    finally:
        session.close()


@app.post("/api/count")
def modify_count():
    session = SessionLocal()
    try:
        payload: Dict[str, Any] = request.get_json(silent=True) or {}
        action = payload.get("action")

        if action == "inc":
            session.add(Counter(count=1))
            session.commit()
        elif action == "clear":
            truncate_or_delete_all(session)

        total_count: int = session.query(Counter).count()
        return jsonify({"code": 0, "data": total_count})
    except SQLAlchemyError as e:
        session.rollback()
        return jsonify({"code": 1, "message": str(e)}), 500
    finally:
        session.close()


@app.get("/api/wx_openid")
def get_wx_openid():
    # Mirror Node.js behavior: only respond when header x-wx-source exists
    if request.headers.get("x-wx-source"):
        return request.headers.get("x-wx-openid", "")
    return ("", 204)


def bootstrap() -> Flask:
    init_db()
    return app


app = bootstrap()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "80"))
    app.run(host="0.0.0.0", port=port)
 