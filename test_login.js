const http = require('http');

const data = JSON.stringify({
  enrollee_id: "crown/2026", // Testing with a mock/known ID if possible, need to find one
  password: "password123"
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/mobile/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(body);
  });
});

req.write(data);
req.end();
