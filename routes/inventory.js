const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');

// Get all inventory items
router.get('/', async (req, res) => {
    try {
        const items = await Inventory.find().sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single inventory item
router.get('/:id', async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }
        res.json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create inventory item
router.post('/', async (req, res) => {
    const item = new Inventory({
        name: req.body.name,
        description: req.body.description,
        hsnCode: req.body.hsnCode,
        unit: req.body.unit,
        price: req.body.price,
        taxRate: req.body.taxRate,
        stock: req.body.stock || 0
    });

    try {
        const newItem = await item.save();
        res.status(201).json(newItem);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update inventory item
router.patch('/:id', async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const updates = req.body;
        Object.keys(updates).forEach(key => {
            if (updates[key] !== undefined) {
                item[key] = updates[key];
            }
        });

        item.updatedAt = new Date();
        const updatedItem = await item.save();
        res.json(updatedItem);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update stock
router.patch('/:id/stock', async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const quantity = Number(req.body.quantity);
        if (isNaN(quantity)) {
            return res.status(400).json({ message: 'Invalid quantity' });
        }

        const newStock = item.stock + quantity;
        if (newStock < 0) {
            return res.status(400).json({ 
                message: 'Cannot reduce stock below 0',
                currentStock: item.stock,
                requestedChange: quantity,
                resultingStock: newStock
            });
        }

        item.stock = newStock;
        item.updatedAt = new Date();
        
        const updatedItem = await item.save();
        res.json(updatedItem);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete inventory item
router.delete('/:id', async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }
        await item.deleteOne();
        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 