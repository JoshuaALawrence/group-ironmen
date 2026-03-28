import { Request, Response, NextFunction } from 'express';
import * as db from './db';

/**
 * Express middleware that authenticates requests against the group token.
 * Sets req.groupId on success.
 * Special case: group_name "_" bypasses auth.
 */
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const groupName = req.params.group_name as string | undefined;
  if (!groupName) {
    res.status(400).send('Missing group name from request');
    return;
  }

  if (groupName === '_') {
    (req as any).groupId = null;
    next();
    return;
  }

  const token = req.headers.authorization;
  if (!token || typeof token !== 'string') {
    res.status(400).send('Authorization header missing from request');
    return;
  }

  db.getGroup(groupName, token)
    .then((groupId) => {
      if (groupId == null) {
        res.status(401).send('');
        return;
      }
      (req as any).groupId = groupId;
      next();
    })
    .catch(() => {
      res.status(401).send('');
    });
}

export default authMiddleware;
