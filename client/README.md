# Mistral AI Chat Frontend

This is the React frontend for the Mistral AI Chatbot application. It provides a modern, responsive user interface for interacting with the Mistral AI-powered chatbot.

## Features

- Modern UI with Material UI components
- Light/Dark mode support
- Real-time chat interface
- User authentication (login/register)
- Session management
- Markdown and code syntax highlighting support
- Responsive design for mobile and desktop

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Backend API running (see main project README)

### Installation

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm start
   ```

3. Build for production:
   ```
   npm run build
   ```

## Project Structure

```
/src
  /components       # Reusable UI components
  /contexts         # React context providers
  /pages            # Main application pages
  /services         # API service functions
  App.js            # Main application component
  index.js          # Application entry point
```

## Technologies Used

- React.js
- Material UI
- React Router
- Axios
- React Markdown
- React Syntax Highlighter

## Environment Variables

The frontend uses a proxy to the backend API, which is configured in the package.json file. By default, it points to http://localhost:5000.

## License

MIT