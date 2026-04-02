class LanternAgent {
  constructor({ board, skill, movement, enemyMarkers }) {
    this.board = { ...board };
    this.skillConfig = { ...skill };
    this.movementConfig = { ...movement };
    this.enemyMarkers = enemyMarkers.map((marker) => ({ ...marker }));

    this.ally = null;
    this.enemies = [];
    this.skill = this.createSkillState();

    this.resetScene(0);
  }

  createSkillState() {
    return {
      charges: this.skillConfig.maxCharges,
      nextChargeReadyAt: null,
      castCooldownUntil: 0,
      moveCooldownUntil: 0,
      nodes: [],
    };
  }

  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  static pointInTriangle(point, a, b, c) {
    const denominator =
      (b.y - c.y) * (a.x - c.x) +
      (c.x - b.x) * (a.y - c.y);

    if (Math.abs(denominator) < 0.000001) {
      return false;
    }

    const alpha =
      ((b.y - c.y) * (point.x - c.x) +
        (c.x - b.x) * (point.y - c.y)) /
      denominator;
    const beta =
      ((c.y - a.y) * (point.x - c.x) +
        (a.x - c.x) * (point.y - c.y)) /
      denominator;
    const gamma = 1 - alpha - beta;
    const epsilon = 0.000001;

    return alpha >= -epsilon && beta >= -epsilon && gamma >= -epsilon;
  }

  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  logicalDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  randomLogicalPoint(existingPoints, minDistance) {
    const minX = this.board.padding;
    const maxX = this.board.cols - this.board.padding - 1;
    const minY = this.board.padding;
    const maxY = this.board.rows - this.board.padding - 1;

    for (let attempt = 0; attempt < 300; attempt += 1) {
      const point = {
        x: this.randomInt(minX, maxX),
        y: this.randomInt(minY, maxY),
      };

      const hasConflict = existingPoints.some((existing) => this.logicalDistance(existing, point) < minDistance);
      if (!hasConflict) {
        return point;
      }
    }

    return {
      x: this.randomInt(minX, maxX),
      y: this.randomInt(minY, maxY),
    };
  }

  randomizeEntities() {
    const used = [];

    const allyPoint = this.randomLogicalPoint(used, this.board.minDistance + 1);
    used.push(allyPoint);

    this.ally = {
      x: allyPoint.x + 0.5,
      y: allyPoint.y + 0.5,
      moveTarget: null,
    };

    this.enemies = this.enemyMarkers.map((marker) => {
      const point = this.randomLogicalPoint(used, this.board.minDistance);
      used.push(point);
      return {
        marker: marker.id,
        x: point.x,
        y: point.y,
      };
    });
  }

  resetSkill(now = 0) {
    this.skill = this.createSkillState();
    this.skill.castCooldownUntil = now;
  }

  resetScene(now = 0) {
    this.randomizeEntities();
    this.resetSkill(now);
  }

  getAllyCenter() {
    if (!this.ally) {
      return null;
    }

    return {
      x: this.ally.x,
      y: this.ally.y,
    };
  }

  getReadyChargeCount(now) {
    this.syncChargeRecovery(now);
    return this.skill.charges;
  }

  refreshAllChargeCooldowns(now) {
    this.skill.charges = this.skillConfig.maxCharges;
    this.skill.nextChargeReadyAt = null;
    this.skill.castCooldownUntil = now;
  }

  syncChargeRecovery(now) {
    if (this.skill.nextChargeReadyAt === null) {
      return;
    }

    while (
      this.skill.charges < this.skillConfig.maxCharges &&
      this.skill.nextChargeReadyAt !== null &&
      now >= this.skill.nextChargeReadyAt
    ) {
      this.skill.charges += 1;
      if (this.skill.charges >= this.skillConfig.maxCharges) {
        this.skill.charges = this.skillConfig.maxCharges;
        this.skill.nextChargeReadyAt = null;
      } else {
        this.skill.nextChargeReadyAt += this.skillConfig.cooldown;
      }
    }
  }

  getNodeSlotId() {
    const usedIds = new Set(this.skill.nodes.map((node) => node.id));
    for (let id = 1; id <= this.skillConfig.maxCharges; id += 1) {
      if (!usedIds.has(id)) {
        return id;
      }
    }

    let oldestNode = this.skill.nodes[0] ?? null;
    for (const node of this.skill.nodes) {
      if (!oldestNode || node.createdAt < oldestNode.createdAt) {
        oldestNode = node;
      }
    }

    return oldestNode ? oldestNode.id : 1;
  }

  getClampedMoveTarget(rawTarget) {
    return {
      x: LanternAgent.clamp(rawTarget.x, 0.5, this.board.cols - 0.5),
      y: LanternAgent.clamp(rawTarget.y, 0.5, this.board.rows - 0.5),
    };
  }

  getEnemyCenter(enemy) {
    return {
      x: enemy.x + 0.5,
      y: enemy.y + 0.5,
    };
  }

  areAllEnemiesCoveredByTriangle() {
    if (this.skill.nodes.length !== 3 || this.enemies.length === 0) {
      return false;
    }

    const [a, b, c] = this.skill.nodes
      .slice()
      .sort((left, right) => left.id - right.id);

    return this.enemies.every((enemy) =>
      LanternAgent.pointInTriangle(this.getEnemyCenter(enemy), a, b, c)
    );
  }

  setMoveTarget(rawTarget) {
    if (!this.ally) {
      return null;
    }

    const target = this.getClampedMoveTarget(rawTarget);
    this.ally.moveTarget = target;
    return target;
  }

  getClampedSkillTarget(rawTarget) {
    const allyCenter = this.getAllyCenter();
    if (!allyCenter) {
      return null;
    }

    const dx = rawTarget.x - allyCenter.x;
    const dy = rawTarget.y - allyCenter.y;
    const distance = Math.hypot(dx, dy);

    let targetX = rawTarget.x;
    let targetY = rawTarget.y;

    if (distance > this.skillConfig.range && distance > 0.0001) {
      const scale = this.skillConfig.range / distance;
      targetX = allyCenter.x + dx * scale;
      targetY = allyCenter.y + dy * scale;
    }

    const margin = this.skillConfig.nodeDiameter / 2;
    return {
      x: LanternAgent.clamp(targetX, margin, this.board.cols - margin),
      y: LanternAgent.clamp(targetY, margin, this.board.rows - margin),
    };
  }

  getClampedMoveNodeTarget(rawTarget) {
    const allyCenter = this.getAllyCenter();
    if (!allyCenter) {
      return null;
    }

    const dx = rawTarget.x - allyCenter.x;
    const dy = rawTarget.y - allyCenter.y;
    const distance = Math.hypot(dx, dy);

    let targetX = rawTarget.x;
    let targetY = rawTarget.y;

    if (distance > this.skillConfig.moveRange && distance > 0.0001) {
      const scale = this.skillConfig.moveRange / distance;
      targetX = allyCenter.x + dx * scale;
      targetY = allyCenter.y + dy * scale;
    }

    const margin = this.skillConfig.nodeDiameter / 2;
    return {
      x: LanternAgent.clamp(targetX, margin, this.board.cols - margin),
      y: LanternAgent.clamp(targetY, margin, this.board.rows - margin),
    };
  }

  castSkill(rawTarget, now) {
    if (!this.ally) {
      return false;
    }

    this.syncChargeRecovery(now);

    if (now < this.skill.castCooldownUntil) {
      return false;
    }

    if (this.skill.charges <= 0) {
      return false;
    }

    const target = this.getClampedSkillTarget(rawTarget);
    if (!target) {
      return false;
    }

    if (this.skill.charges === this.skillConfig.maxCharges) {
      this.skill.nextChargeReadyAt = now + this.skillConfig.cooldown;
    }
    this.skill.charges -= 1;
    this.skill.castCooldownUntil = now + this.skillConfig.castCooldown;

    const slotId = this.getNodeSlotId();
    const existingNode = this.skill.nodes.find((node) => node.id === slotId);
    if (existingNode) {
      existingNode.x = target.x;
      existingNode.y = target.y;
      existingNode.createdAt = now;
    } else {
      this.skill.nodes.push({
        id: slotId,
        x: target.x,
        y: target.y,
        createdAt: now,
      });
    }

    this.skill.nodes.sort((a, b) => a.id - b.id);
    return true;
  }

  moveSkillNode(nodeId, rawTarget, now) {
    if (!this.ally) {
      return false;
    }

    if (now < this.skill.moveCooldownUntil) {
      return false;
    }

    const targetNode = this.skill.nodes.find((node) => node.id === nodeId);
    if (!targetNode) {
      return false;
    }

    const target = this.getClampedMoveNodeTarget(rawTarget);
    if (!target) {
      return false;
    }

    targetNode.x = target.x;
    targetNode.y = target.y;
    this.skill.moveCooldownUntil = now + this.skillConfig.moveCooldown;
    this.skill.nodes.sort((a, b) => a.id - b.id);
    return true;
  }

  updateMovement(delta) {
    if (!this.ally || !this.ally.moveTarget) {
      return;
    }

    const dx = this.ally.moveTarget.x - this.ally.x;
    const dy = this.ally.moveTarget.y - this.ally.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= 0.0001) {
      this.ally.x = this.ally.moveTarget.x;
      this.ally.y = this.ally.moveTarget.y;
      this.ally.moveTarget = null;
      return;
    }

    const maxStep = this.movementConfig.speed * delta;
    if (distance <= maxStep) {
      this.ally.x = this.ally.moveTarget.x;
      this.ally.y = this.ally.moveTarget.y;
      this.ally.moveTarget = null;
      return;
    }

    this.ally.x += (dx / distance) * maxStep;
    this.ally.y += (dy / distance) * maxStep;
  }

  updateSkillNodes(now) {
    if (!this.ally) {
      return;
    }

    const allyCenter = this.getAllyCenter();
    let vanishedByDistance = false;

    this.skill.nodes = this.skill.nodes.filter((node) => {
      const age = now - node.createdAt;
      if (age > this.skillConfig.nodeLifetime) {
        return false;
      }

      const distance = Math.hypot(node.x - allyCenter.x, node.y - allyCenter.y);
      if (distance > this.skillConfig.maxNodeDistance) {
        vanishedByDistance = true;
        return false;
      }

      return true;
    });

    if (vanishedByDistance) {
      this.refreshAllChargeCooldowns(now);
    }

    this.skill.nodes.sort((a, b) => a.id - b.id);
  }

  update(now, delta) {
    this.syncChargeRecovery(now);
    this.updateMovement(delta);
    this.updateSkillNodes(now);
  }
}

window.LanternAgent = LanternAgent;
