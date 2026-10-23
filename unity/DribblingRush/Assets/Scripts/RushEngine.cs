// Dribbling Rush rules: a C# port of src/lib/kosu/engine.ts (same numbers, same seeded RNG), kept free of
// UnityEngine so it stays a plain, deterministic simulation. World units are metres: x across (lanes at
// -LANE, 0, +LANE), y up, z forward. When a rule changes, change it in both files.
using System;
using System.Collections.Generic;

namespace Rush
{
    public enum Ev { None, Coin, Bump, Dead, Jump, Roll, Lane, Goal, Save, Power, Saved, Splash, Land, Letter, Word }

    /// <summary>0 slide tackle (jump), 1 board (roll), 2 standing defender (switch lane), 3 cones (jump),
    /// 4 a wall of four players (switch lane), 5 a sprinkler (jump it or get soaked)</summary>
    public class Obstacle
    {
        public float z;
        public int lane, kind, moveTo;
        public bool hit;
        public int id;
    }

    /// <summary>Something long in a lane, from z to z + len: its front is a wall, its roof a floor. A standing one (a dugout)
    /// may have a ramp (a sloped pitch-side board) up to the roof in front of it; a driving one (v > 0, the groundsman's
    /// mower) comes at the runner.</summary>
    public class Block
    {
        public float z, len, v;
        public int lane;
        public bool ramp;
        public int id;
    }

    public class Coin
    {
        public float z, y;
        public int lane;
        public bool taken;
        public int id;
    }

    /// <summary>A letter of the footballer's name being spelt, floating over a lane.</summary>
    public class Letter
    {
        public float z;
        public int lane;
        public char ch;
        public bool taken;
        public int id;
    }

    /// <summary>0 boots, 1 magnet, 2 armband, 3 double points, 4 jet (fly over everything), 5 spring boots (jump high)</summary>
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
        /// <summary>the 3D game moves softer: a floatier jump, an eased lane change, a longer roll</summary>
        const float SOFT_JUMP_V = 9f, SOFT_GRAVITY = -26f, SOFT_SLAM_V = -24f, SOFT_SLIDE_S = 0.72f, SOFT_LANE_SNAP = 11f;
        public const float STUMBLE_S = 2.6f;
        const float AHEAD = 90f;
        const float HIT_Z = 0.55f;
        const float WET_S = 1.1f, WET_SPEED = 0.62f;
        public static readonly float[] POWER_S = { 5, 9, 0, 10, 6, 10 };
        const float POWER_GAP = 170f;
        const float BOOST = 1.6f, BOOST_GRACE = 0.8f;
        const float MAGNET_R = 7f;
        const float GOAL_FIRST = 260f, GOAL_GAP = 420f, GOAL_CLEAR = 75f;
        public const int MULT_MAX = 5;
        const float GOAL_POINTS = 100f;
        public const float DRIFT_AT = 26f;
        /// <summary>blocks: roof height, the ramp's length, how fast a driving one comes, from where on they show up</summary>
        public const float ROOF_H = 2.5f, RAMP_LEN = 7f, MOVER_V = 6f;
        const float BLOCK_FROM = 140f;
        /// <summary>spring boots jump this high (≈ 2.8 m: onto a roof); the jet flies at JET_Y</summary>
        const float JUMP_HI = 12f;
        public const float JET_Y = 6f;
        const float JET_GRACE = 1f;
        /// <summary>letters: the first this far in, then every LETTER_GAP or so; a finished name pays this (times the
        /// multiplier), raises the multiplier and sets off a free jet flight</summary>
        const float LETTER_FIRST = 90f, LETTER_GAP = 70f;
        const float WORD_POINTS = 250f;

        /// <summary>blocks, jet and spring boots: on in the 3D game (false = the older rules of the 2.5D one)</summary>
        public readonly bool extras;
        public uint rng;
        public float t, z, speed = SPEED0;
        public int lane, from;
        public float x, y, vy, slide, stumble = 99;
        /// <summary>the floor under the runner (a roof, a ramp or the grass)</summary>
        public float gy;
        /// <summary>a forward fall / caught: when it happened (0 = running)</summary>
        public float dead;
        public string deadKind = "";
        public readonly List<Obstacle> obstacles = new List<Obstacle>();
        public readonly List<Block> blocks = new List<Block>();
        public readonly List<Coin> coins = new List<Coin>();
        public readonly List<Pickup> pickups = new List<Pickup>();
        public readonly List<Goal> goals = new List<Goal>();
        public readonly List<Letter> letters = new List<Letter>();
        /// <summary>the footballers' names to spell (uppercase A–Z), the one being spelt and how far</summary>
        public readonly string[] words;
        public int wordIdx, letterIdx, wordsDone;
        public float nextLetter = LETTER_FIRST;
        public float next = 34;
        public int coinsTaken;
        public int events;
        public Ev lastEvent;
        /// <summary>every event of the last step, in order (the view and the app read these)</summary>
        public readonly List<Ev> stepEvents = new List<Ev>();
        public int lastPowerKind;
        public float nextGoal = GOAL_FIRST, nextPower = 120;
        public float boots, magnet, dbl, ghost, wet, jet, spring;
        public int armband;
        public int[] answers;
        public int goalsScored, saves, mult = 1;
        public float score;
        public float camX, camY, shake;
        int ids;

        public RunState(uint seed, int[] answers, bool extras = true, string[] words = null)
        {
            rng = seed;
            this.extras = extras;
            this.words = words ?? new string[0];
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
        /// <summary>the name being spelt ("" with none)</summary>
        public string Word => words.Length > 0 ? words[wordIdx % words.Length] : "";

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
            // a sprinkler now and then (the 2.5D game; the 3D one has none)
            if (rz > 120 && Rnd() < 0.18f && !extras) Add(rz + 14, free, 5, free);
            // the next letter of the name, in the open lane, past the row's coins (clear of everything else, so it reads)
            if (extras && words.Length > 0 && rz > nextLetter)
            {
                letters.Add(new Letter { z = rz + 8, lane = free, ch = Word[letterIdx], id = ++ids });
                nextLetter = rz + LETTER_GAP + Rnd() * 40;
            }
            if (rz > nextPower && Math.Abs(rz - nextGoal) > 90)
            {
                float r2 = Rnd();
                int kind = extras
                    ? (r2 < 0.22f ? 1 : r2 < 0.4f ? 3 : r2 < 0.56f ? 2 : r2 < 0.68f ? 0 : r2 < 0.84f ? 4 : 5)
                    : (r2 < 0.3f ? 1 : r2 < 0.55f ? 3 : r2 < 0.8f ? 2 : 0);
                pickups.Add(new Pickup { z = rz + (extras ? 15 : 9), lane = free, kind = kind, id = ++ids });
                nextPower = rz + POWER_GAP + Rnd() * 120;
            }
        }

        void AddBlock(float bz, float len, int ln, bool ramp, float v) =>
            blocks.Add(new Block { z = bz, len = len, lane = ln, ramp = ramp, v = v, id = ++ids });

        /// <summary>Coins along a dugout: up its ramp (if it has one) and along the roof.</summary>
        void RoofCoins(Block b, float z0, float z1)
        {
            for (float cz = z0; cz <= z1; cz += 2.2f)
            {
                float cy = cz >= b.z ? ROOF_H : b.ramp ? Math.Max(0, ROOF_H * (cz - (b.z - RAMP_LEN)) / RAMP_LEN) : 0;
                coins.Add(new Coin { z = cz, lane = b.lane, y = cy, id = ++ids });
            }
        }

        /// <summary>A stretch of blocks from z = rz; returns where it ends. Every lane can be got through: a ramp,
        /// open grass, or (beside the mower coming at you) a lane to step into.</summary>
        float LayBlocks(float rz)
        {
            float level = Math.Min(1, z / 2500);
            float len = 18 + (float)Math.Floor(Rnd() * 3) * 6;
            int main = (int)Math.Floor(Rnd() * 3) - 1;
            float end = rz + len;
            if (Rnd() < 0.55f)
            {
                // a ramp up onto a dugout; beside it more dugouts (some with ramps) or open grass with coins
                AddBlock(rz, len, main, true, 0);
                var b = blocks[blocks.Count - 1];
                RoofCoins(b, rz - RAMP_LEN + 1, rz + len - 1);
                foreach (var l in new[] { -1, 0, 1 })
                {
                    if (l == main) continue;
                    float r3 = Rnd();
                    if (r3 < 0.45f) AddBlock(rz + (float)Math.Floor(Rnd() * 3) * 2, len, l, false, 0);
                    else if (r3 < 0.62f) AddBlock(rz + 6, len - 6, l, true, 0);
                    else if (Rnd() < 0.5f) Add(rz + len * 0.5f, l, Rnd() < 0.5f ? 1 : 0, l);
                }
                // now and then the next dugout is a jump away: hop across the gap along the roofs
                if (Rnd() < 0.35f + level * 0.3f)
                {
                    const float GAP = 5;
                    float len2 = 12 + (float)Math.Floor(Rnd() * 2) * 6;
                    for (float cz = end + 0.6f; cz < end + GAP; cz += 1.6f)
                    {
                        float k = (cz - end) / GAP;
                        coins.Add(new Coin { z = cz, lane = main, y = ROOF_H + 1.4f * (float)Math.Sin(k * Math.PI), id = ++ids });
                    }
                    AddBlock(end + GAP, len2, main, false, 0);
                    RoofCoins(blocks[blocks.Count - 1], end + GAP + 1, end + GAP + len2 - 1);
                    end += GAP + len2;
                }
            }
            else
            {
                // the mower driving at you: it meets the runner about here; one lane beside it is open grass
                const float MOVER = 4.5f;
                float meet = rz + len * 0.5f;
                float start = meet + (meet - z) * MOVER_V / Math.Max(speed, 1);
                AddBlock(start, MOVER, main, false, MOVER_V);
                int open = main == 0 ? (Rnd() < 0.5f ? -1 : 1) : 0;
                CoinLine(rz, open, (int)(len / 2.2f), 0);
                foreach (var l in new[] { -1, 0, 1 })
                {
                    if (l == main || l == open) continue;
                    if (Rnd() < 0.6f)
                    {
                        AddBlock(rz, len, l, true, 0);
                        RoofCoins(blocks[blocks.Count - 1], rz - RAMP_LEN + 1, rz + len - 1);
                    }
                }
                end = Math.Max(end, start + MOVER);
            }
            return end;
        }

        /// <summary>The floor at x, z: a roof, a ramp or the grass (0); onRamp when it's a ramp.</summary>
        public float FloorAt(float px, float pz, out bool onRamp)
        {
            float h = 0;
            onRamp = false;
            foreach (var b in blocks)
            {
                if (Math.Abs(px - b.lane * LANE) > LANE * 0.5f) continue;
                if (pz >= b.z && pz <= b.z + b.len) h = Math.Max(h, ROOF_H);
                else if (b.ramp && pz >= b.z - RAMP_LEN && pz < b.z)
                {
                    float rh = ROOF_H * (pz - (b.z - RAMP_LEN)) / RAMP_LEN;
                    if (rh > h)
                    {
                        h = rh;
                        onRamp = true;
                    }
                }
            }
            return h;
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

        /// <summary>A crash the armband forgives: true if it did.</summary>
        bool Forgive()
        {
            if (armband <= 0) return false;
            armband = 0;
            ghost = 1.2f;
            shake = 0.3f;
            Emit(Ev.Saved);
            return true;
        }

        /// <summary>The jet's coin trail up in the air, wandering across the lanes.</summary>
        void JetCoins()
        {
            int ln = lane;
            float until = z + POWER_S[4] * speed * 1.05f;
            for (float cz = z + 14; cz < until; cz += 2.6f)
            {
                coins.Add(new Coin { z = cz, lane = ln, y = JET_Y - 0.4f, id = ++ids });
                if (Rnd() < 0.08f) ln = Math.Max(-1, Math.Min(1, ln + (Rnd() < 0.5f ? -1 : 1)));
            }
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
            if (jet > 0)
            {
                jet = Math.Max(0, jet - dt);
                if (jet == 0) ghost = JET_GRACE;
            }
            magnet = Math.Max(0, magnet - dt);
            dbl = Math.Max(0, dbl - dt);
            spring = Math.Max(0, spring - dt);
            ghost = Math.Max(0, ghost - dt);
            stumble += dt;
            shake = Math.Max(0, shake - dt);
            foreach (var b in blocks) b.z -= b.v * dt;

            bool grounded = y <= gy + 0.001f;
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
            else if (input == "up" && grounded && jet <= 0)
            {
                vy = spring > 0 ? JUMP_HI : extras ? SOFT_JUMP_V : JUMP_V;
                slide = 0;
                Emit(Ev.Jump);
            }
            else if (input == "down" && jet <= 0)
            {
                if (!grounded) vy = extras ? SOFT_SLAM_V : SLAM_V;
                slide = extras ? SOFT_SLIDE_S : SLIDE_S;
                Emit(Ev.Roll);
            }

            x += (lane * LANE - x) * Math.Min(1, dt * (extras ? SOFT_LANE_SNAP : LANE_SNAP));
            gy = 0;
            bool onRamp = false;
            if (extras) gy = FloorAt(x, z, out onRamp);
            if (jet > 0)
            {
                // up and away over everything
                y += (JET_Y - y) * Math.Min(1, dt * 4);
                vy = 0;
            }
            else
            {
                // a ramp carries you up; so do the boots and a forgiven crash when a roof is under you
                if (y < gy && (onRamp || gy - y < 0.6f || boots > 0 || ghost > 0))
                {
                    y = gy;
                    if (vy < 0) vy = 0;
                }
                if (y > gy + 0.001f || vy > 0)
                {
                    vy += (extras ? SOFT_GRAVITY : GRAVITY) * dt;
                    y += vy * dt;
                    if (y <= gy)
                    {
                        if (extras && vy < -11) Emit(Ev.Land);
                        y = gy;
                        vy = 0;
                    }
                }
            }
            if (slide > 0 && y <= gy + 0.001f) slide = Math.Max(0, slide - dt);
            camX += (x * 0.85f - camX) * Math.Min(1, dt * (extras ? 5 : 7));
            camY += (gy * 0.85f + (y - gy) * 0.35f - camY) * Math.Min(1, dt * 6);

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
                // a stretch of blocks now and then, never into a goal's run-in
                if (extras && next > BLOCK_FROM && (answers.Length == 0 || next + 120 < nextGoal - GOAL_CLEAR) && Rnd() < 0.3f + Math.Min(1, z / 2500) * 0.15f)
                {
                    next = LayBlocks(next) + 12 + Rnd() * 8;
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
            blocks.RemoveAll(b => b.z + b.len < behind);
            coins.RemoveAll(c => c.z < behind);
            pickups.RemoveAll(p => p.z < behind);
            letters.RemoveAll(l => l.z < behind);
            goals.RemoveAll(g => g.z < z - 30);

            foreach (var p in pickups)
            {
                if (p.taken || Math.Abs(p.z - z) > 1 || Math.Abs(p.lane * LANE - x) > 1.2f || y > 1.6f) continue;
                p.taken = true;
                if (p.kind == 0) boots = POWER_S[0];
                else if (p.kind == 1) magnet = POWER_S[1];
                else if (p.kind == 2) armband = 1;
                else if (p.kind == 3) dbl = POWER_S[3];
                else if (p.kind == 4)
                {
                    jet = POWER_S[4];
                    slide = 0;
                    JetCoins();
                }
                else spring = POWER_S[5];
                lastPowerKind = p.kind;
                Emit(Ev.Power);
            }

            foreach (var l in letters)
            {
                if (l.taken || Math.Abs(l.z - z) > 1 || Math.Abs(l.lane * LANE - x) > 1.2f || y - gy > 1.8f) continue;
                l.taken = true;
                // a letter left over from before (one was missed and dealt again) only counts as a coin
                if (l.ch != Word[letterIdx])
                {
                    score += 10 * Mult;
                    continue;
                }
                letterIdx++;
                Emit(Ev.Letter);
                if (letterIdx < Word.Length) continue;
                // the name is done: points, a higher multiplier and a free flight
                wordsDone++;
                score += WORD_POINTS * Mult;
                mult = Math.Min(MULT_MAX, mult + 1);
                wordIdx++;
                letterIdx = 0;
                jet = POWER_S[4];
                slide = 0;
                JetCoins();
                Emit(Ev.Word);
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

            if (boots > 0 || ghost > 0 || jet > 0) return;
            // blocks: the front is a wall, the side bounces you back to your lane
            foreach (var b in blocks)
            {
                float into = z + 0.4f - b.z;
                if (into < 0 || z > b.z + b.len || y >= ROOF_H - 0.45f) continue;
                float dx = Math.Abs(b.lane * LANE - x);
                if (dx > LANE * 0.62f) continue;
                if (into <= (v + b.v) * dt + 0.05f && dx < LANE * 0.45f)
                {
                    if (Forgive()) return;
                    Die("front");
                    return;
                }
                if (lane == b.lane && lane != from)
                {
                    lane = from;
                    Bump();
                    if (Dead) return;
                }
            }
            foreach (var o in obstacles)
            {
                float dz = o.z - z;
                if (dz > HIT_Z || dz < -HIT_Z) continue;
                float ox = ObstacleX(o);
                float dx = Math.Abs(ox - x);
                if (dx > LANE * 0.62f) continue;
                // high above (off a roof, spring boots) everything on the grass is cleared
                bool clears = y > 2.1f || (o.kind == 0 || o.kind == 3 || o.kind == 5 ? y > 0.55f : o.kind == 1 ? slide > 0 : false);
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
                if (Forgive()) return;
                Die("front");
                return;
            }
        }
    }
}
