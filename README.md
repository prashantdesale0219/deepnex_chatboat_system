# MERN-Stack Chatbot Backend

A standalone backend service for a MERN-stack chatbot application that integrates with Mistral AI for natural language understanding and response generation.

## Features

- RESTful APIs for managing chatbot configurations and conversations
- Secure integration with Mistral AI API
- MongoDB data persistence
- JWT authentication and authorization
- Rate limiting and input validation
- Swagger API documentation

## Tech Stack

- **Node.js & Express**: Backend server and API
- **MongoDB**: Database for storing configurations, sessions, and messages
- **Mistral AI**: Natural language processing and response generation
- **JWT**: Authentication and authorization
- **Swagger**: API documentation

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Mistral AI API key

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/gpt-chatbot.git
   cd gpt-chatbot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=5000
   NODE_ENV=development
   MONGO_URI=mongodb://localhost:27017/chatbot
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRES_IN=24h
   MISTRAL_API_KEY=your_mistral_api_key_here
   MISTRAL_API_URL=https://api.mistral.ai/v1
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX_REQUESTS=60
   ```

4. Start the server:
   ```bash
   npm run dev
   ```

## API Documentation

Once the server is running, you can access the Swagger documentation at:
```
http://localhost:5000/api-docs
```

Alternatively, you can view the list of all API endpoints in the `api.txt` file.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/update-details` - Update user details
- `PUT /api/auth/update-password` - Update password

### Configurations
- `POST /api/configs` - Create configuration
- `GET /api/configs` - Get all configurations
- `GET /api/configs/:id` - Get single configuration
- `PUT /api/configs/:id` - Update configuration
- `DELETE /api/configs/:id` - Delete configuration

### Sessions
- `POST /api/sessions` - Create session
- `GET /api/sessions` - Get all sessions
- `GET /api/sessions/:sessionId` - Get single session
- `DELETE /api/sessions/:sessionId` - Delete session
- `POST /api/sessions/:sessionId/messages` - Send message
- `GET /api/sessions/:sessionId/messages` - Get conversation history

### Webhook
- `POST /api/webhook` - External channel integration

## Testing

Run tests with:
```bash
npm test
```

## Deployment

For production deployment:

1. Set `NODE_ENV=production` in your environment
2. Build and run the Docker container:
   ```bash
   docker build -t chatbot-api .
   docker run -p 5000:5000 chatbot-api
   ```

## License

MIT

## Created For

Prashant