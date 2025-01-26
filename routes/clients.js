const express = require('express');
const router = express.Router();
const Client = require('../models/Client');

// Get all clients
router.get('/', async (req, res) => {
    try {
        const clients = await Client.find().sort({ createdAt: -1 });
        res.json(clients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single client
router.get('/:id', async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }
        res.json(client);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create client
router.post('/', async (req, res) => {
    const client = new Client({
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        gstin: req.body.gstin,
        address: {
            street: req.body.address.street,
            city: req.body.address.city,
            state: req.body.address.state,
            pincode: req.body.address.pincode,
            country: req.body.address.country || 'India'
        }
    });

    try {
        const newClient = await client.save();
        res.status(201).json(newClient);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update client
router.patch('/:id', async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }

        if (req.body.name) client.name = req.body.name;
        if (req.body.email) client.email = req.body.email;
        if (req.body.phone) client.phone = req.body.phone;
        if (req.body.gstin) client.gstin = req.body.gstin;
        if (req.body.address) {
            client.address = {
                ...client.address,
                ...req.body.address
            };
        }

        const updatedClient = await client.save();
        res.json(updatedClient);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete client
router.delete('/:id', async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }
        await client.deleteOne();
        res.json({ message: 'Client deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 