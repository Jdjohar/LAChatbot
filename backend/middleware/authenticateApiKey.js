const User = require('../models/User');

module.exports = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  // ✅ Bypass for internal system (admin user)
if (req.headers['x-internal-auth'] === 'true') {
  console.log('Internal auth request received ✅');

  // Explicit test query
  const admins = await User.find({});
  console.log('Total users in DB:', admins.length);
  admins.forEach(u => console.log(`User: ${u.username}, isAdmin: ${u.isAdmin}, Type: ${typeof u.isAdmin}`));

  const adminUser = admins.find(u => u.isAdmin === true);
  if (!adminUser) {
    console.error('⚠️ Admin user not found even though users exist');
    return res.status(401).json({ error: 'Admin user not found' });
  }

  req.user = { id: adminUser._id };
  return next();
}

  // 🧱 Default behavior: widget-based API key authentication
  if (!apiKey) {
    console.error('Missing API key in request');
    return res.status(401).json({ error: 'Missing API key' });
  }

  try {
    const user = await User.findOne({ widgetApiKey: apiKey });
    if (!user) {
      console.error(`Invalid API key: ${apiKey}`);
      return res.status(401).json({ error: 'Invalid API key' });
    }
    req.user = { id: user._id };
    next();
  } catch (err) {
    console.error('API key authentication error:', err);
    res.status(401).json({ error: 'Invalid API key' });
  }
};
