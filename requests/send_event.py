import json
import os
from pathlib import Path
from typing import Any, Dict

import requests

"""
Event Sender Module

This module provides functionality to send test events to the FastAPI endpoint.
It reads JSON event files from the events directory and sends them to the running
application for processing and storage in the database.

Prerequisites:
    - All Docker containers must be running (API, database, vector store)
    - Events must be properly formatted JSON files in the events directory
    - API endpoint must be accessible (default: http://localhost:8080)
"""


DEFAULT_BASE_URL = os.getenv("DOCULENS_API_BASE_URL", "http://localhost:8080")
API_KEY_VALUE = os.getenv("DOCULENS_API_KEY")
API_KEY_HEADER = os.getenv("DOCULENS_API_KEY_HEADER", "X-API-Key")
BASE_URL = f"{DEFAULT_BASE_URL.rstrip('/')}/events"
EVENTS_DIR = Path(__file__).parent.parent / "requests/events"


def load_event(event_file: str):
    """Load event data from JSON file.

    Args:
        event_file: Name of the JSON file in the events directory

    Returns:
        Dict containing the event data
    """
    with open(EVENTS_DIR / event_file, "r") as f:
        return json.load(f)


def send_event(event_file: str) -> Dict[str, Any]:
    """Send event to the API endpoint for processing.

    Args:
        event_file: Name of the JSON file to send
    """
    payload = load_event(event_file)
    headers = {"Content-Type": "application/json"}
    if API_KEY_VALUE:
        headers[API_KEY_HEADER] = API_KEY_VALUE

    response = requests.post(BASE_URL, json=payload, headers=headers)

    print(f"Testing {event_file}:")
    print(f"Status Code: {response.status_code}")
    assert response.status_code == 202
    try:
        data = response.json()
    except ValueError as exc:
        raise AssertionError("Expected JSON response from server.") from exc

    print(json.dumps(data, indent=2))

    assert data.get("event_id"), "Response must include event_id."
    assert data.get("task_id"), "Response must include task_id."
    assert isinstance(data.get("message"), str) and data["message"]
    return data


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Send an event JSON file to the API.")
    parser.add_argument(
        "event_file",
        nargs="?",
        default="your-event.json",
        help="Name of the JSON file inside requests/events/",
    )
    args = parser.parse_args()
    send_event(event_file=args.event_file)
