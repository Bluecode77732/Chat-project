const { io } = require('socket.io-client');

// User 1
const token1 = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInR5cGUiOiJhY2Nlc3MiLCJyb2xlIjowLCJpYXQiOjE3NzE4NTkxMjcsImV4cCI6MTc3MTg2MDEyNn0.N2pLxGxWfITPYBUk9QEy2-u5yQbpIVEC6h1z5HDLo7I';

const client1 = io('http://localhost:3000', {
    auth: { token: token1 }
});

client1.on('connect', () => {
    console.log('✅ User 1 connected:', client1.id);
});

client1.on('sendMessage', (data) => {
    console.log('📩 User 1 received:', data);
});

client1.on('SendMessage', (data) => {
    console.log('📩 User 1 received (uppercase):', data);
});

// User 2
const token2 = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsInR5cGUiOiJhY2Nlc3MiLCJyb2xlIjowLCJpYXQiOjE3NzE4NTkxNTEsImV4cCI6MTc3MTg2MDE1MH0.7BXidV0bak9Ac9Tup2a_C3MposMIGMkbmIXHHIrzWtI';

const client2 = io('http://localhost:3000', {
    auth: { token: token2 }
});

client2.on('connect', () => {
    console.log('✅ User 2 connected:', client2.id);

    // Send message after 1 second
    setTimeout(() => {
        console.log('📤 User 1 sending to User 2...');
        client1.emit('sendMessage', {
            message: 'Hello User 2!',
            recipientId: 2
        });
    }, 1000);
});

client2.on('sendMessage', (data) => {
    console.log('📩 User 2 received:', data);
});

client2.on('SendMessage', (data) => {
    console.log('📩 User 2 received (uppercase):', data);
});