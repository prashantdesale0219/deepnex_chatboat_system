# प्रोजेक्ट-स्पेसिफिक कॉन्फिगरेशन गाइड

इस फोल्डर में प्रोजेक्ट-स्पेसिफिक कॉन्फिगरेशन फाइल्स हैं जो आपके चैटबॉट को विभिन्न प्रोजेक्ट्स के लिए कॉन्फिगर करने की अनुमति देती हैं।

## प्रोजेक्ट कॉन्फिगरेशन का उपयोग कैसे करें

### 1. नया प्रोजेक्ट कॉन्फिगरेशन बनाना

नया प्रोजेक्ट कॉन्फिगरेशन बनाने के लिए, आप निम्न API एंडपॉइंट का उपयोग कर सकते हैं:

```
POST /api/configs/projects/:projectId
```

जहां `:projectId` आपके प्रोजेक्ट का यूनिक आइडेंटिफायर है (जैसे `customer_support`, `technical_docs`, आदि)।

रिक्वेस्ट बॉडी में निम्न फील्ड्स शामिल करें:

```json
{
  "name": "प्रोजेक्ट का नाम",
  "purpose": "चैटबॉट का उद्देश्य",
  "domain": ["डोमेन1", "डोमेन2"],
  "tone": {
    "style": "professional",
    "language": "hi"
  },
  "channels": ["web"],
  "integrations": [],
  "ai": {
    "provider": "mistral",
    "model": "mistral-small",
    "temperature": 0.7,
    "max_tokens": 1000
  }
}
```

### 2. प्रोजेक्ट कॉन्फिगरेशन का उपयोग करके चैट सेशन शुरू करना

प्रोजेक्ट कॉन्फिगरेशन का उपयोग करके चैट सेशन शुरू करने के लिए, निम्न API एंडपॉइंट का उपयोग करें:

```
POST /api/sessions/project/:projectId
```

जहां `:projectId` आपके प्रोजेक्ट का आइडेंटिफायर है।

### 3. सभी उपलब्ध प्रोजेक्ट कॉन्फिगरेशन देखना

सभी उपलब्ध प्रोजेक्ट कॉन्फिगरेशन देखने के लिए:

```
GET /api/configs/projects
```

### 4. विशिष्ट प्रोजेक्ट कॉन्फिगरेशन देखना

किसी विशिष्ट प्रोजेक्ट का कॉन्फिगरेशन देखने के लिए:

```
GET /api/configs/projects/:projectId
```

## प्रोजेक्ट कॉन्फिगरेशन फाइल

`projects.json` फाइल में सभी प्रोजेक्ट कॉन्फिगरेशन स्टोर किए जाते हैं। आप इस फाइल को सीधे एडिट कर सकते हैं, लेकिन परिवर्तनों को प्रभावी करने के लिए आपको सर्वर को रीस्टार्ट करना होगा या निम्न API एंडपॉइंट का उपयोग करना होगा:

```
POST /api/configs/projects/sync
```

## डिफॉल्ट कॉन्फिगरेशन

यदि किसी प्रोजेक्ट के लिए कोई कॉन्फिगरेशन नहीं मिलता है, तो सिस्टम डिफॉल्ट कॉन्फिगरेशन का उपयोग करेगा, जो `projects.json` फाइल में `default` कुंजी के अंतर्गत परिभाषित है।

## उदाहरण उपयोग

### फ्रंटएंड से प्रोजेक्ट-स्पेसिफिक चैटबॉट का उपयोग

```javascript
// प्रोजेक्ट आईडी के आधार पर चैट सेशन शुरू करें
async function startProjectChat(projectId) {
  const response = await fetch('/api/sessions/project/' + projectId, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + userToken
    }
  });
  
  const data = await response.json();
  return data.data; // सेशन ऑब्जेक्ट
}

// सेशन आईडी का उपयोग करके मैसेज भेजें
async function sendMessage(sessionId, message) {
  const response = await fetch(`/api/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + userToken
    },
    body: JSON.stringify({ message })
  });
  
  const data = await response.json();
  return data.data; // AI रिस्पांस
}
```