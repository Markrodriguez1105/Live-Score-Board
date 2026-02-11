# Pageant Live Scoreboard

A standalone, responsive frontend application for displaying live pageant scores from a Google Sheet.

## Stack
- Vite
- TypeScript
- Tailwind CSS v4

## Quick Start

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Configure Environment**
    Copy `.env.example` to `.env` and fill in your Google Sheet ID and API Key.
    ```bash
    cp .env.example .env
    ```

3.  **Run Locally**
    ```bash
    npm run dev
    ```

## Google Sheet Structure
The app expects a Google Sheet with the following columns (order matters for the code, though specific headers don't):
- Column A: Candidate Name
- Column B: Judge 1 Score
- Column C: Judge 2 Score
- Column D: Judge 3 Score
- Column E: Total Percentage (Optional formula or manual entry)

## Deployment
To deploy to GitHub Pages or Vercel:
1.  Run `npm run build`.
2.  Upload the `dist` folder content (or configure the platform to run the build command).
