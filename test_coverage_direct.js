const { signEnrolleeToken } = require('./lib/mobile-auth');
const http = require('http');

async function test() {
  const token = await signEnrolleeToken({
    id: 'cmhb5nob2002fiu92v7xv0hgb',
    email: 'timileyin@gmail.com', // Placeholder
    name: 'olatimilehin bamidele',
    role: 'ENROLLEE',
    enrollee_id: 'CJH/KB/3104'
  });

  console.log('Generated Token:', token);

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/mobile/enrollee/coverage',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('BODY:', body);
    });
  });

  req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
  });

  req.end();
}

test().catch(console.error);
