const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');

dotenv.config();

const app = express();

// Custom Morgan token for response time in a more readable format
morgan.token('response-time-ms', function (req, res) {
    const time = this['response-time'](req, res);
    return time ? `${time}ms` : '';
});

// Custom Morgan token for request body
morgan.token('req-body', (req) => JSON.stringify(req.body));

// Custom Morgan format with request body for POST/PUT/PATCH requests
const morganFormat = ':method :url :status :response-time-ms - :res[content-length] bytes - :remote-addr - :date[iso]';
const morganPostFormat = `${morganFormat} - body: :req-body`;

// Middleware
app.use(morgan((tokens, req, res) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        return morgan.compile(morganPostFormat)(tokens, req, res);
    }
    return morgan.compile(morganFormat)(tokens, req, res);
}));

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/accounting_app', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB Connection Error:', err));

// Routes
const clientRoutes = require('./routes/clients');
const inventoryRoutes = require('./routes/inventory');
const invoiceRoutes = require('./routes/invoices');
const businessDetailsRoutes = require('./routes/businessDetails');

app.use('/api/clients', clientRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/business', businessDetailsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        body: req.body
    });
    
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 