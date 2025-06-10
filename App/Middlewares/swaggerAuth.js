export default function swaggerAuth(req, res, next) {
    const auth = { login: process.env.SWAGGER_USER, password: process.env.SWAGGER_PASSWORD };
  
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
  
    if (login && password && login === auth.login && password === auth.password) {
      return next();
    }
  
    res.set('WWW-Authenticate', 'Basic realm="Swagger Docs"');
    return res.status(401).send('Authentication required.');
  }
  