// Dribbling Rush rules: a C# port of src/lib/kosu/engine.ts (same numbers, same seeded RNG), kept free of
// UnityEngine so it stays a plain, deterministic simulation. World units are metres: x across (lanes at
// -LANE, 0, +LANE), y up, z forward. When a rule changes, change it in both files.
using System;
using System.Collections.Generic;

namespace Rush
{
    public enum Ev { None, Coin, Bump, Dead, Jump, Roll, Lane, Goal, Save, Power, Saved, Splash }

    /// <summary>0 slide tackle (jump), 1 board (roll), 2 standing defender (switch lane), 3 cones (jump),
    /// 4 a wall of four players (switch lane), 5 a sprinkler (jump it or get soaked)</summary>
    public class Obstacle
    {
        public float z;
        public int lane, kind, moveTo;
        public bool hit;
        public int id;
    }

    public class Coin
    {
        public float z, y;
        public int lane;
        public bool taken;
        public int id;
    }

    /// <summary>0 boots, 1 magnet, 2 armband, 3 double points</summary>
    public class Pickup
    {
        public float z;
        public int lane, kind;
        public bool taken;
        public int id;
    }

    public class Goal
    {
        public float z;
        /// <summary>the right answer's lane (-1, 0, 1); result 0 not yet, 1 scored, -1 saved</summary>
        public int correct, result, q;
    }

    public class RunState
    {
        public const float LANE = 2.4f;
        public const float SPEED0 = 11f, SPEED_MAX = 27f;
        const float ACCEL = 0.11f;
        const float JUMP_V = 9.6f, GRAVITY = -31f, SLAM_V = -26f;
        const float SLIDE_S = 0.62f;
        const float LANE_SNAP = 16f;
        const float STUMBLE_S = 2.6f;
        const float AHEAD = 90f;
        const float HIT_Z = 0.55f;
        const float WET_S = 1.1f, WET_SPEED = 0.62f;
        public static readonly float[] POWER_S = { 5, 9, 0, 10 };
        const float POWER_GAP = 170f;
        const float BOOST = 1.6f, BOOST_GRACE = 0.8f;
        const float MAGNET_R = 7f;
        const float GOAL_FIRST = 260f, GOAL_GAP = 420f, GOAL_CLEAR = 75f;
        public const int MULT_MAX = 5;
        const float GOAL_POINTS = 100f;
        public const float DRIFT_AT = 26f;

        public uint rng;
        public float t, z, speed = SPEED0;
        public int lane, from;
        public float x, y, vy, slide, stumble = 99;
        /// <summary>a forward fall / caught: when it happened (0 = running)</summary>
        public float dead;
        public string deadKind = "";
        public readonly List<Obstacle> obstacles = new List<Obstacle>();
        public readonly List<Coin> coins = new List<Coin>();
        public readonly List<Pickup> pickups = new List<Pickup>();
        public readonly List<Goal> goals = new List<Goal>();
        public float next = 34;
        public int coinsTaken;
        public int events;
        public Ev lastEvent;
        /// <summary>every event of the last step, in order (the view and the app read these)</summary>
        public readonly List<Ev> stepEvents = new List<Ev>();
        public int lastPowerKind;
        public float nextGoal = GOAL_FIRST, nextPower = 120;
        public float boots, magnet, dbl, ghost, wet;
        public int armband;
        public int[] answers;
        public int goalsScored, saves, mult = 1;
        public float score;
        public float camX, camY, shake;
        int ids;

        public RunState(uint seed, int[] answers)
        {
            rng = seed;
            this.answers = answers ?? new int[0];
            // a free run-up with a coin line before the first obstacles
            for (int i = 0; i < 8; i++) coins.Add(new Coin { z = 12 + i * 2.2f, lane = 0, y = 0, id = ++ids });
        }

        float Rnd()
        {
            unchecked
            {
                rng = rng + 0x6d2b79f5u;
                uint t = rng;
                t = (t ^ (t >> 15)) * (t | 1u);
                t ^= t + (t ^ (t >> 7)) * (t | 61u);
                return (t ^ (t >> 14)) / 4294967296f;
            }
        }

        public int Score => (int)Math.Floor(score);
        public int Mult => mult * (dbl > 0 ? 2 : 1);
        public bool Dead => dead > 0;

        public Goal NextGoal()
        {
            foreach (var g in goals) if (g.result == 0) return g;
            return null;
        }

        void Emit(Ev e)
        {
            events++;
            lastEvent = e;
            stepEvents.Add(e);
        }

        void CoinLine(float z0, int ln, int n, float arcAt)
        {
            for (int i = 0; i < n; i++)
            {
                float cz = z0 + i * 2.2f;
                float d = arcAt != 0 ? Math.Abs(cz - arcAt) : 99;
                float cy = d < 4 ? 1.5f * (float)Math.Cos(d / 4 * (Math.PI / 2)) : 0;
                coins.Add(new Coin { z = cz, lane = ln, y = cy, id = ++ids });
            }
        }

        void Add(float oz, int ln, int kind, int moveTo) =>
            obstacles.Add(new Obstacle { z = oz, lane = ln, kind = kind, moveTo = moveTo, id = ++ids });

        /// One row of obstacles at z: one or two lanes blocked, always one lane you can run, jump or roll through.
        void LayRow(float rz)
        {
            float level = Math.Min(1, z / 2500);
            float r = Rnd();
            int free = (int)Math.Floor(Rnd() * 3) - 1;
            var lanes = new List<int>();
            foreach (var l in new[] { -1, 0, 1 }) if (l != free) lanes.Add(l);
            if (r < 0.28f)
            {
                int kind = Rnd() < 0.5f + level * 0.2f ? 1 : Rnd() < 0.5f ? 0 : 3;
                foreach (var l in new[] { -1, 0, 1 }) Add(rz, l, kind, l);
                CoinLine(rz - 6, free, 6, kind == 1 ? 0 : rz);
            }
            else if (r < 0.62f)
            {
                foreach (var l in lanes)
                {
                    if (Rnd() < 0.22f + level * 0.15f)
                    {
                        Add(rz, l, 4, l);
                        continue;
                    }
                    int drift = level > 0.25f && Rnd() < 0.25f ? free : l;
                    Add(rz, l, 2, drift);
                }
                CoinLine(rz - 8, free, 7, 0);
            }
            else
            {
                int kind = Rnd() < 0.5f ? 0 : 1;
                Add(rz, lanes[0], 2, lanes[0]);
                Add(rz, lanes[1], kind, lanes[1]);
                CoinLine(rz - 6, kind == 0 ? lanes[1] : free, 6, kind == 0 ? rz : 0);
            }
            if (rz > 120 && Rnd() < 0.18f) Add(rz + 14, free, 5, free);
            if (rz > nextPower && Math.Abs(rz - nextGoal) > 90)
            {
                float r2 = Rnd();
                int kind = r2 < 0.3f ? 1 : r2 < 0.55f ? 3 : r2 < 0.8f ? 2 : 0;
                pickups.Add(new Pickup { z = rz + 9, lane = free, kind = kind, id = ++ids });
                nextPower = rz + POWER_GAP + Rnd() * 120;
            }
        }

        /// lane x of an obstacle now (a drifting defender slides across as you close in)
        public float ObstacleX(Obstacle o)
        {
            if (o.moveTo == o.lane) return o.lane * LANE;
            float k = Math.Max(0, Math.Min(1, (DRIFT_AT - (o.z - z)) / 10));
            return (o.lane + (o.moveTo - o.lane) * k) * LANE;
        }

        void Bump()
        {
            shake = 0.25f;
            Emit(Ev.Bump);
            if (stumble < STUMBLE_S)
            {
                if (armband > 0)
                {
                    armband = 0;
                    ghost = 1.2f;
                    stumble = 99;
                    Emit(Ev.Saved);
                    return;
                }
                Die("caught");
                return;
            }
            stumble = 0;
        }

        void Die(string kind)
        {
            dead = Math.Max(t, 0.0001f);
            deadKind = kind;
            shake = 0.45f;
            Emit(Ev.Dead);
        }

        /// <summary>Advance the run by dt seconds with this input ("" = none).</summary>
        public void Step(string input, float dt)
        {
            stepEvents.Clear();
            t += dt;
            if (dead > 0)
            {
                speed = Math.Max(0, speed - 40 * dt);
                z += speed * dt;
                shake = Math.Max(0, shake - dt);
                return;
            }
            speed = Math.Min(SPEED_MAX, speed + ACCEL * dt * (1 + speed / SPEED_MAX));
            float v = (boots > 0 ? speed * BOOST : speed) * (wet > 0 ? WET_SPEED : 1);
            wet = Math.Max(0, wet - dt);
            z += v * dt;
            score += v * dt * Mult;
            if (boots > 0)
            {
                boots = Math.Max(0, boots - dt);
                if (boots == 0) ghost = BOOST_GRACE;
            }
            magnet = Math.Max(0, magnet - dt);
            dbl = Math.Max(0, dbl - dt);
            ghost = Math.Max(0, ghost - dt);
            stumble += dt;
            shake = Math.Max(0, shake - dt);

            bool grounded = y <= 0.001f;
            if (input == "left" || input == "right")
            {
                int to = Math.Max(-1, Math.Min(1, lane + (input == "left" ? -1 : 1)));
                if (to != lane)
                {
                    from = lane;
                    lane = to;
                    Emit(Ev.Lane);
                }
                else Bump();
            }
            else if (input == "up" && grounded)
            {
                vy = JUMP_V;
                slide = 0;
                Emit(Ev.Jump);
            }
            else if (input == "down")
            {
                if (!grounded) vy = SLAM_V;
                slide = SLIDE_S;
                Emit(Ev.Roll);
            }

            x += (lane * LANE - x) * Math.Min(1, dt * LANE_SNAP);
            if (!grounded || vy > 0)
            {
                vy += GRAVITY * dt;
                y = Math.Max(0, y + vy * dt);
                if (y == 0) vy = 0;
            }
            if (slide > 0 && y == 0) slide = Math.Max(0, slide - dt);
            camX += (x * 0.85f - camX) * Math.Min(1, dt * 7);
            camY += (y * 0.35f - camY) * Math.Min(1, dt * 6);

            while (next < z + AHEAD)
            {
                if (answers.Length > 0 && next > nextGoal - GOAL_CLEAR)
                {
                    int q = goals.Count;
                    goals.Add(new Goal { z = nextGoal, correct = answers[q % answers.Length], q = q });
                    CoinLine(nextGoal - 40, 0, 6, 0);
                    next = nextGoal + 40;
                    nextGoal += GOAL_GAP + Rnd() * 120;
                    continue;
                }
                LayRow(next);
                float gap = 30 - Math.Min(14, z / 180) + Rnd() * 8;
                next += gap;
            }

            foreach (var g in goals)
            {
                if (g.result != 0 || z < g.z) continue;
                int ln = Math.Max(-1, Math.Min(1, (int)Math.Round(x / LANE)));
                if (ln == g.correct)
                {
                    g.result = 1;
                    goalsScored++;
                    score += GOAL_POINTS * Mult;
                    mult = Math.Min(MULT_MAX, mult + 1);
                    Emit(Ev.Goal);
                }
                else
                {
                    g.result = -1;
                    saves++;
                    mult = 1;
                    Emit(Ev.Save);
                }
            }
            float behind = z - 8;
            obstacles.RemoveAll(o => o.z < behind);
            coins.RemoveAll(c => c.z < behind);
            pickups.RemoveAll(p => p.z < behind);
            goals.RemoveAll(g => g.z < z - 30);

            foreach (var p in pickups)
            {
                if (p.taken || Math.Abs(p.z - z) > 1 || Math.Abs(p.lane * LANE - x) > 1.2f || y > 1.6f) continue;
                p.taken = true;
                if (p.kind == 0) boots = POWER_S[0];
                else if (p.kind == 1) magnet = POWER_S[1];
                else if (p.kind == 2) armband = 1;
                else dbl = POWER_S[3];
                lastPowerKind = p.kind;
                Emit(Ev.Power);
            }

            foreach (var c in coins)
            {
                if (c.taken) continue;
                bool pulled = magnet > 0 && c.z - z < MAGNET_R && c.z - z > -0.5f;
                if (!pulled && Math.Abs(c.z - z) > 0.9f) continue;
                if (pulled || (Math.Abs(c.lane * LANE - x) < 1.1f && Math.Abs(c.y - y) < 1.2f))
                {
                    c.taken = true;
                    coinsTaken++;
                    score += 10 * Mult;
                    Emit(Ev.Coin);
                }
            }

            if (boots > 0 || ghost > 0) return;
            foreach (var o in obstacles)
            {
                float dz = o.z - z;
                if (dz > HIT_Z || dz < -HIT_Z) continue;
                float ox = ObstacleX(o);
                float dx = Math.Abs(ox - x);
                if (dx > LANE * 0.62f) continue;
                bool clears = o.kind == 0 || o.kind == 3 || o.kind == 5 ? y > 0.55f : o.kind == 1 ? slide > 0 : false;
                if (clears) continue;
                if (o.kind == 5)
                {
                    if (!o.hit && dx < LANE * 0.45f)
                    {
                        o.hit = true;
                        wet = WET_S;
                        shake = 0.15f;
                        Emit(Ev.Splash);
                    }
                    continue;
                }
                if (dx > LANE * 0.32f && lane != from)
                {
                    lane = from;
                    Bump();
                    continue;
                }
                if (armband > 0)
                {
                    armband = 0;
                    ghost = 1.2f;
                    shake = 0.3f;
                    Emit(Ev.Saved);
                    return;
                }
                Die("front");
                return;
            }
        }
    }
}
