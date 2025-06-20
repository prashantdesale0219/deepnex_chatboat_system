# Important Note for API Testing

## MongoDB ObjectId Format

When testing the API endpoints, please note that all IDs (like `configId`, `sessionId`, etc.) must be valid MongoDB ObjectIds. A MongoDB ObjectId is a 24-character hexadecimal string.

### Common Error

If you see an error like this:

```
CastError: Cast to ObjectId failed for value "CONFIG_ID_HERE" (type string) at path "_id" for model "Config"
```

It means you're using a placeholder string instead of a valid MongoDB ObjectId.

### How to Fix

1. **Create a configuration first**: Use the `POST /api/configs` endpoint to create a configuration and get a valid ID.

2. **Use the returned ID**: When you get a response with an ID, use that actual ID in subsequent requests.

3. **Format**: Make sure the ID is a 24-character hexadecimal string (e.g., `615f7d4e1c9d440000a1b3e5`).

### Example Workflow

1. Create a configuration:
   ```
   POST /api/configs
   ```

2. Get the ID from the response:
   ```json
   {
     "success": true,
     "data": {
       "_id": "615f7d4e1c9d440000a1b3e5",
       "name": "Customer Support Bot",
       ...
     }
   }
   ```

3. Use this ID for creating a session:
   ```json
   {
     "configId": "615f7d4e1c9d440000a1b3e5"
   }
   ```

Remember to replace all placeholder IDs in the `api.txt` file with actual IDs from your database.