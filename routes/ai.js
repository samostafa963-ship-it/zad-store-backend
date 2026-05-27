const express = require('express');
const router = express.Router();
const Replicate = require('replicate');

router.post('/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      { input: { prompt, num_outputs: 1, aspect_ratio: "16:9" } }
    );
    res.json({ imageUrl: output[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;