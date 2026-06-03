function adminMiddleware(req, res, next) {
  if (req.user && req.user.role === "admin") {
    next(); // User is an admin, proceed to the next middleware or route handler
  } else {
    return res.status(403).json({ message: "Forbidden: Access denied!" });
  }
}
export default adminMiddleware;
