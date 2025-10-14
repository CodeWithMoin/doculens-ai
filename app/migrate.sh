#!/bin/bash

# source ./.env  # Removed: not needed for Docker-based workflows

docker exec -it "$PROJECT_NAME"_api bash -c "alembic upgrade head"