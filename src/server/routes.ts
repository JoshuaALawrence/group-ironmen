import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import config from './config';
import * as db from './db';
import logger from './logger';
import { validName, validateMemberPropLength } from './validators';
import { COLLECTION_LOG_DATA } from './collection-log';
import * as externalServices from './external-services';
import authMiddleware from './auth-middleware';

const SHARED_MEMBER = db.SHARED_MEMBER;

// ── Unauthed router (/api) ──

export const unauthedRouter = express.Router();

unauthedRouter.post('/create-group', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};

    // captcha
    if (config.hcaptcha.enabled) {
      const captchaResponse = body.captcha_response || '';
      const verifyRes = await axios.post(
        'https://hcaptcha.com/siteverify',
        new URLSearchParams({ response: captchaResponse, secret: config.hcaptcha.secret }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      if (!verifyRes.data.success) {
        res.status(400).send('Captcha response verification failed');
        return;
      }
    }

    const memberNames: unknown[] = body.member_names || [];
    if (memberNames.length > 5) {
      res.status(400).send('Too many member names provided');
      return;
    }

    const name = (body.name || '').trim();
    if (!validName(name)) {
      res.status(400).send('Provided group name is not valid');
      return;
    }

    const filteredMembers = (memberNames as string[]).filter(
      (n) => typeof n === 'string' && n.trim().length > 0
    );
    for (const mn of filteredMembers) {
      if (!validName(mn)) {
        res.status(400).send(`Member name ${mn} is not valid`);
        return;
      }
    }

    const token = uuidv4();
    const createGroupData: db.CreateGroupData = {
      name,
      member_names: filteredMembers,
      token,
    };

    await db.createGroup(createGroupData);
    res.status(201).json({ name, member_names: filteredMembers, token });
  } catch (err) {
    logger.error('Error creating group: ' + (err as Error).message);
    res.status(500).send('');
  }
});

unauthedRouter.get('/ge-prices', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Content-Type', 'application/json');
  res.send(externalServices.getGePricesJson());
});

unauthedRouter.get('/captcha-enabled', (_req: Request, res: Response) => {
  res.json({ enabled: config.hcaptcha.enabled, sitekey: config.hcaptcha.sitekey });
});

unauthedRouter.get('/collection-log-info', (_req: Request, res: Response) => {
  res.set('Content-Type', 'application/json');
  res.send(COLLECTION_LOG_DATA);
});

unauthedRouter.get(
  '/wise-old-man/players/:playerName/boss-kc',
  async (req: Request, res: Response) => {
    try {
      await externalServices.handleGetWiseOldManPlayerBossKc(req, res);
    } catch (err) {
      logger.error('Error fetching WOM boss kc: ' + (err as Error).message);
      res.status(500).send('');
    }
  }
);

// ── Authed router (/api/group/:group_name) ──

export const authedRouter = express.Router({ mergeParams: true });
authedRouter.use(authMiddleware);

authedRouter.post('/add-group-member', async (req: Request, res: Response) => {
  try {
    const memberName = req.body && req.body.name;
    if (memberName === SHARED_MEMBER) {
      res.status(400).send(`Member name ${SHARED_MEMBER} not allowed`);
      return;
    }
    if (!validName(memberName)) {
      res.status(400).send(`Member name ${memberName} is not valid`);
      return;
    }
    await db.addGroupMember((req as any).groupId, memberName);
    req.app.locals.notifier.notifyGroup((req as any).groupId);
    res.status(201).end();
  } catch (err) {
    if ((err as any).statusCode) {
      res.status((err as any).statusCode).send((err as Error).message);
      return;
    }
    logger.error('Error adding group member: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.delete('/delete-group-member', async (req: Request, res: Response) => {
  try {
    const memberName = req.body && req.body.name;
    if (memberName === SHARED_MEMBER) {
      res.status(400).send(`Member name ${SHARED_MEMBER} not allowed`);
      return;
    }
    await db.deleteGroupMember((req as any).groupId, memberName);
    req.app.locals.notifier.notifyGroup((req as any).groupId);
    res.status(200).end();
  } catch (err) {
    logger.error('Error deleting group member: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.put('/rename-group-member', async (req: Request, res: Response) => {
  try {
    const { original_name, new_name } = req.body || {};
    if (original_name === SHARED_MEMBER || new_name === SHARED_MEMBER) {
      res.status(400).send(`Member name ${SHARED_MEMBER} not allowed`);
      return;
    }
    if (!validName(new_name)) {
      res.status(400).send(`Member name ${new_name} is not valid`);
      return;
    }
    await db.renameGroupMember((req as any).groupId, original_name, new_name);
    req.app.locals.notifier.notifyGroup((req as any).groupId);
    res.status(200).end();
  } catch (err) {
    logger.error('Error renaming group member: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.post('/update-group-member', async (req: Request, res: Response) => {
  try {
    const member = req.body || {};
    const inGroup = await db.isMemberInGroup((req as any).groupId, member.name);
    if (!inGroup) {
      res.status(401).send('Player is not a member of this group');
      return;
    }

    validateMemberPropLength('stats', member.stats, 7, 7);
    validateMemberPropLength('coordinates', member.coordinates, 3, 4);
    validateMemberPropLength('skills', member.skills, 23, 24);
    validateMemberPropLength('quests', member.quests, 0, 220);
    validateMemberPropLength('inventory', member.inventory, 56, 56);
    validateMemberPropLength('equipment', member.equipment, 28, 28);
    validateMemberPropLength('bank', member.bank, 0, 3000);
    validateMemberPropLength('shared_bank', member.shared_bank, 0, 1000);
    validateMemberPropLength('rune_pouch', member.rune_pouch, 6, 8);
    validateMemberPropLength('seed_vault', member.seed_vault, 0, 500);
    validateMemberPropLength('deposited', member.deposited, 0, 200);
    validateMemberPropLength('diary_vars', member.diary_vars, 0, 62);
    validateMemberPropLength('collection_log_v2', member.collection_log_v2, 0, 4000);

    member.group_id = (req as any).groupId;
    logger.info(
      `Queueing group update group_id=${(req as any).groupId} member=${member.name}`
    );
    req.app.locals.batcher.enqueue(member);
    res.status(200).end();
  } catch (err) {
    if ((err as any).statusCode) {
      res.status((err as any).statusCode).send((err as Error).message);
      return;
    }
    logger.error('Error updating group member: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.get('/get-group-data', async (req: Request, res: Response) => {
  try {
    const fromTime = req.query.from_time as string;
    const groupMembers = await db.getGroupData((req as any).groupId, fromTime);
    res.json(groupMembers);
  } catch (err) {
    logger.error('Error getting group data: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.get('/group-events', (req: Request, res: Response) => {
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  res.write(': connected\n\n');

  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 30000);

  const sub = req.app.locals.notifier.subscribe((req as any).groupId);
  const unsub = sub.on(() => {
    res.write('data: update\n\n');
  });

  req.on('close', () => {
    clearInterval(keepAlive);
    unsub();
  });
});

authedRouter.get('/get-skill-data', async (req: Request, res: Response) => {
  try {
    const periodParam = req.query.period as string;
    let period: string;
    switch (periodParam) {
      case 'Day': period = 'day'; break;
      case 'Week': period = 'month'; break;
      case 'Month': period = 'month'; break;
      case 'Year': period = 'year'; break;
      default: period = 'day';
    }
    const data = await db.getSkillsForPeriod((req as any).groupId, period);
    res.json(data);
  } catch (err) {
    logger.error('Error getting skill data: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.get('/am-i-logged-in', (_req: Request, res: Response) => {
  res.status(200).end();
});

authedRouter.get('/am-i-in-group', async (req: Request, res: Response) => {
  try {
    const memberName = req.query.member_name as string;
    const inGroup = await db.isMemberInGroup((req as any).groupId, memberName);
    if (!inGroup) {
      res.status(401).send('Player is not a member of this group');
      return;
    }
    res.status(200).end();
  } catch (err) {
    logger.error('Error checking group membership: ' + (err as Error).message);
    res.status(500).send('');
  }
});

authedRouter.get('/collection-log', (_req: Request, res: Response) => {
  res.json({});
});
