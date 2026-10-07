# Project context

Docker Compose infrastructure for the "Tendencias" course assignment (see `Actividad1_Docker.pdf`): PostgreSQL, Flask API (`web`), pgAdmin and an Nginx frontend.

## Commit conventions

- Write all commit messages in **English**.
- Follow [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<optional scope>): <description>`.
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- Use the imperative mood, lowercase description, no trailing period, header under 72 characters.
- Keep each commit focused on a single logical change.

## Project rules

- Never hardcode credentials; they live only in `.env` (`.env.example` is the template).
- The PostgreSQL service (`db`) must never publish ports to the host.
