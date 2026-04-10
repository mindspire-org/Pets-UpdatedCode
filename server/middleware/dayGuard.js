import DaySession from '../models/DaySession.js';

// dayGuard: returns an express middleware that ensures the portal has an OPEN day session today
// portalResolver can be:
// - a string portal name
// - a function (req) => portal string
export default function dayGuard(portalResolver) {
  return async function(req, res, next) {
    try {
      const portal = typeof portalResolver === 'function' ? portalResolver(req) : portalResolver;
      if (!portal) {
        return res.status(400).json({ success: false, message: 'Portal is required for day guard' });
      }
      const today = new Date();
      const date = today.toISOString().slice(0,10);
      const session = await DaySession.findOne({ portal, date, status: 'open' }).lean();
      if (!session) {
        return res.status(423).json({ // 423 Locked
          success: false,
          message: `Day is not open for portal ${portal}. Please open the day before performing this action.`
        });
      }
      // Make session available downstream
      req.daySession = session;
      next();
    } catch (e) {
      next(e);
    }
  }
}
