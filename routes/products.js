router.get('/category/:key/grouped', async (req, res) => {
  try {
    const products = await Product.aggregate([
      { $match: { category_key: req.params.key } },
      {
        $group: {
          _id: "$sub_category",
          products: { $push: "$$ROOT" },
          sub_category_order: { $first: "$sub_category_order" }
        }
      },
      { $sort: { sub_category_order: 1 } }
    ]);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});