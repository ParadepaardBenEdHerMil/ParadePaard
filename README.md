# ParadePaard

[![CI](https://github.com/moodhood/ParadePaard/actions/workflows/ci.yml/badge.svg)](https://github.com/moodhood/ParadePaard/actions/workflows/ci.yml)

Local setup and run instructions for the ParadePaard project.

## Requirements

Install these before starting:

- Git
- Docker Desktop
- Node.js and npm

Make sure Docker Desktop is running before starting the backend.

## Project Structure

```text
Program/
  frontend/       Frontend application
  microservice/   Backend services and Docker Compose setup
```

## Install

Clone the repository:

```sh
git clone https://github.com/moodhood/ParadePaard.git
cd ParadePaard
```

Install the frontend dependencies:

```sh
cd Program/frontend
npm install
```

The backend dependencies are built by Docker when starting the services.

## Start the Backend

Open a terminal from the repository root:

```sh
cd Program/microservice
docker compose up --build -d
```

This builds and starts the backend services in Docker.

## Start the Frontend

Open a second terminal from the repository root:

```sh
cd Program/frontend
npm run dev
```

When Vite starts, open:

```text
http://localhost:5173
```

## First Admin

Production and shared environments must bootstrap the first admin through a secure one-time process. Do not commit reusable admin usernames or passwords to this repository.

The auth-service bootstraps the first `SUPER_ADMIN` from environment variables on startup. Set these once (e.g. in your `.env` or secret manager), start the stack, then log in and change the password:

```env
BOOTSTRAP_ADMIN_USERNAME=your.admin
BOOTSTRAP_ADMIN_EMAIL=admin@yourcompany.example
BOOTSTRAP_ADMIN_PASSWORD=<a strong one-time password>
```

The account is created with `mustChangePassword` set, so it is forced to change its password on first login. The runner is idempotent (it skips if the user already exists) and does nothing when the variables are unset, so no default credentials are ever shipped. After the first admin exists, unset `BOOTSTRAP_ADMIN_PASSWORD` again so the one-time password isn't left in the environment.

## Stop the Project

Stop the frontend by pressing `Ctrl + C` in the terminal running `npm run dev`.

Stop the backend from the `Program/microservice` folder:

```sh
docker compose down
```

## Common Commands

Rebuild and restart the backend:

```sh
cd Program/microservice
docker compose up --build -d
```

View running backend containers:

```sh
docker compose ps
```

View backend logs:

```sh
docker compose logs -f
```
