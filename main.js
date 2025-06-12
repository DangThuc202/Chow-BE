import http from 'http';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 1234;

let storedFbAccessToken = null;
console.log(storedFbAccessToken);


const server = http.createServer(async (req, res) => {
  // CORS headers - luôn gửi cho mọi request
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request (OPTIONS) cho tất cả các route
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

    if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(' Hello from LinkedIn Auth Backend!');
    return;
  }

  // Route: Exchange code for access token
  if (req.method === 'POST' && req.url === '/linkedin-login') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const formParams = new URLSearchParams(body);
        const code = formParams.get('code');
        const redirect_uri = formParams.get('redirect_uri');
        const client_id = formParams.get('client_id');
        const client_secret = formParams.get('client_secret');

        const linkedinParams = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri,
          client_id,
          client_secret,
        });

        const response = await axios.post(
          'https://www.linkedin.com/oauth/v2/accessToken',
          linkedinParams.toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }
        );

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(response.data));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        console.error("LinkedIn API error:", err?.response?.data || err.message);
        res.end(JSON.stringify({ error: err?.response?.data || err.message }));
      }
    });

  // Route: Get LinkedIn User Info
  } else if (req.method === 'GET' && req.url?.startsWith('/linkedin-userinfo')) {
    const access_token = req.headers.authorization?.replace("Bearer ", "");

    if (!access_token) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing access_token' }));
      return;
    }

    try {
      const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(response.data));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      console.error("LinkedIn UserInfo error:", err?.response?.data || err.message);
      res.end(JSON.stringify({ error: err?.response?.data || err.message }));
    }

  // Route: Post to LinkedIn
  } else if (req.method === 'POST' && req.url === '/linkedin-post') {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body);
      const { sub, content } = payload;

      const access_token = req.headers.authorization?.replace('Bearer ', '');
      if (!access_token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing access token' }));
      }

      if (!sub || !content) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing sub or content in body' }));
      }

      const postData = {
        author: `urn:li:person:${sub}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: 'ARTICLE',
            media: [
              {
                status: 'READY',
                description: {
                  text: 'Official LinkedIn Blog - Your source for insights and information about LinkedIn.',
                },
                originalUrl: 'https://blog.linkedin.com/',
                title: {
                  text: 'Official LinkedIn Blog',
                },
              },
            ],
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      console.log('postData:', postData);

      const response = await axios.post(
        'https://api.linkedin.com/v2/ugcPosts',
        postData,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Type': 'application/json',
          },
        }
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response.data));
    } catch (err) {
      console.error('LinkedIn Post error:', err?.response?.data || err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err?.response?.data || err.message }));
    }
  });
} else if (req.method === 'POST' && req.url === '/fb/save-token') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { access_token } = JSON.parse(body);

        if (!access_token) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing access_token' }));
          return;
        }

        storedFbAccessToken = access_token;        

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        console.error('❌ JSON parse failed:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/fb/token') {
    
    if (!storedFbAccessToken) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No token found' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accessToken: storedFbAccessToken }));
    }
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
