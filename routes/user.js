export default (app, router) => {
    const db = router.db

    app.get('/users/:id/total-spent', (req, res) => {
        const userId = Number(req.params.id);
        console.log("selam")
        if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });

        const user = db.get('users').find(u => Number(u.id) === userId).value();
        if (!user) return res.status(404).json({ error: 'user not found' });

        const orders = db.get('orders').filter({ userId }).value() || [];
        const total = orders.reduce((acc, o) => acc + (isNaN(parseFloat(o.totalAmount)) ? 0 : parseFloat(o.totalAmount)), 0);
        res.json({ userId, ordersCount: orders.length, total: Number(total.toFixed(2)) });
     });
};