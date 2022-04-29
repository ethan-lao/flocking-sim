class vec3 {
    x: number;
    y: number;
    z: number;

    constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    add(other: vec3) {
        let sumX = this.x + other.x;
        let sumY = this.y + other.y;
        let sumZ = this.z + other.z;
        return new vec3(sumX, sumY, sumZ);
    }

    subtract(other: vec3) {
        let diffX = this.x - other.x;
        let diffY = this.y - other.y;
        let diffZ = this.z - other.z;
        return new vec3(diffX, diffY, diffZ);
    }

    updateAdd(other: vec3) {
        this.x += other.x;
        this.y += other.y;
        this.z += other.z;
        return this;
    }

    updateSubtract(other: vec3) {
        this.x -= other.x;
        this.y -= other.y;
        this.z -= other.z;
        return this;
    }

    scaleUp(c: number) {
        return new vec3(this.x * c, this.y * c, this.z * c);
    }

    scaleDown(c: number) {
        return this.scaleUp(1.0 / c);
    }

    updateScaleUp(c: number) {
        this.x *= c;
        this.y *= c;
        this.z *= c;
        return this;
    }

    updateScaleDown(c: number) {
        return this.updateScaleUp(1.0 / c);
    }

    negate() {
        return this.scaleUp(-1);
    }

    updateNegate() {
        return this.updateScaleUp(-1);
    }

    normSquared() {
        return Math.pow(this.x, 2) + 
            Math.pow(this.y, 2) + 
            Math.pow(this.z, 2);
    }

    norm() {
        return Math.sqrt(this.normSquared());
    }

    normalize() {
        let thisNorm = this.norm();

        // return this if norm is 0
        if (thisNorm === 0) {
            return this.copy();
        }

        return new vec3(
            this.x / thisNorm,
            this.y / thisNorm,
            this.z / thisNorm
        );
    }

    updateNormalize() {
        let thisNorm = this.norm();

        // do nothing if norm is 0
        if (thisNorm === 0) {
            return this;
        }

        this.x /= thisNorm;
        this.y /= thisNorm;
        this.z /= thisNorm;
        return this;
    }

    distance(other: vec3) {
        return this.subtract(other).norm();
    }

    copy() {
        return new vec3(this.x, this.y, this.z);
    }
}

function randPos(max) {
    return Math.floor(Math.random() * max);
}

// const timestep = 10;
const timestep = .03;

class Bird {
    pos: vec3;
    dir: vec3;
    predator: boolean;
    dead: boolean;

    updatePos(pos: vec3) {
        this.pos = pos;
    }

    updateDir(dir: vec3) {
        this.dir = dir;
    }

    updatePredator(predator: boolean){
        this.predator = predator;
    }

    constructor(pos: vec3, dir: vec3, predator: boolean, dead: boolean) {
        this.updatePos(pos);
        this.updateDir(dir);
        this.updatePredator(predator);
        this.dead = dead;
    }

    distance(other: Bird) {
        return this.pos.distance(other.pos);
    }
}

class FlockingSim {
    numBirds: number;
    birds: Bird[] = [];
    width: number;
    height: number;
    depth: number;
    
    static readonly SPEEDLIMIT = 200;
    static readonly BIRDFATNESS = 20;

    constructor(numBirds: number, numPredators: number, width: number, height: number, depth: number) {
        this.numBirds = numBirds + numPredators;
        this.width = width;
        this.height = height;
        this.depth = depth;

        for (let i = 0; i < numBirds; i++) {
            let pos = new vec3(randPos(width), randPos(height), randPos(depth));
            let dir = new vec3(randPos(100), randPos(100), randPos(100));
            dir.updateNormalize();

            this.birds.push(new Bird(pos, dir, false, false))
        }

        for (let i = 0; i < numPredators; i++) {
            let pos = new vec3(randPos(width), randPos(height), randPos(depth));
            let dir = new vec3(randPos(100), randPos(100), randPos(100));
            dir.updateNormalize();

            this.birds.push(new Bird(pos, dir, true, false));
        }
    }

    getCur() {
        let ret = [];
        for (let b of this.birds) {
            ret.push([b.pos, b.dir, b.predator, b.dead]);
        }
        return ret;
    }



    speed(dir: vec3, limit: number = FlockingSim.SPEEDLIMIT) {
        let spd = Math.sqrt(dir.x ** 2 + dir.y ** 2 + dir.z ** 2);
        if (spd > limit){
            dir.x = dir.x / spd * limit;
            dir.y = dir.y / spd * limit;
            dir.z = dir.z / spd * limit;
        }
    }

    inBounds(pos: vec3, dir: vec3){
        let margin = 70;

        function diffToUpdate(diff: number) {
            if (diff > margin) {
                return 9999;
            }
            return ((margin * -1000) / (diff - margin)) - 1000
        }
        
        if (pos.x < 0){
            let diff = -pos.x;
            dir.x += diffToUpdate(diff);
        }
        if (pos.y < 0){
            let diff = -pos.y;
            dir.y += diffToUpdate(diff);
        }
        if (pos.z < 0){
            let diff = -pos.z;
            dir.z += diffToUpdate(diff);
        }
        if (pos.x > this.width){
            let diff = pos.x - this.width;
            dir.x -= diffToUpdate(diff);
        }
        if (pos.y > this.height){
            let diff = pos.y - this.height;
            dir.y -= diffToUpdate(diff);
        }
        if (pos.z > this.depth){
            let diff = pos.z - this.depth;
            dir.z -= diffToUpdate(diff);
        }
    }


    // these params range from 0-100
    // result: update positions and directions of birds
    // returns: array of positions and directions
    // eg. [[pos1: vec3, dir1: vec3], [pos2: vec3, dir2: vec3]... ]
    getNextStep(separation: number, alignment: number, cohesion: number, momentum: number, 
                lightAttraction: number, fear: number, visualRange: number, predVisualRange: number, predSpeed: number,
                light: vec3, useLight: boolean) {
        let ret = [];
        let newBirds = [];

        // first mark the dead birds
        for (let bird of this.birds) {
            if (!bird.predator) {
                continue;
            }

            for (let b of this.birds) {
                if (b === bird || b.predator) {
                    continue;
                }

                if (b.distance(bird) < FlockingSim.BIRDFATNESS) {
                    b.dead = true;
                }
            }
        }

        for (let bird of this.birds) {
            if (bird.dead) {
                newBirds.push(bird);
                ret.push([bird.pos, bird.dir, bird.predator, bird.dead]);
                continue;
            }

            
            if (bird.predator) {
                // if this is a predator, go to nearest bird in visual range
                let closestBird;
                let sepDir = new vec3(0, 0, 0);
                let closestDist = 99999999;
                let found = false;
                for (let b of this.birds) {
                    if (b === bird) {
                        continue;
                    }

                    if (b.dead) {
                        continue;
                    }

                    let dist = b.distance(bird);

                    

                    if (dist <= predVisualRange) {
                        // add separation from other predators
                        if (b.predator) {
                            if (dist < 2 * separation ** 2) {           // Arbitary num
                                sepDir.updateAdd(bird.pos.subtract(b.pos))
                            }
                            continue;
                        }
                        
                        if (dist < closestDist) {
                            found = true;
                            closestDist = dist;
                            closestBird = b.pos;
                        }
                    }
                }

                let newDir = bird.dir.scaleUp(momentum);
                newDir.updateAdd(sepDir.updateScaleUp(separation * 2));
                if (found) {
                    newDir.updateAdd(closestBird.subtract(bird.pos).updateNormalize().updateScaleUp(predSpeed * 2));
                }

                this.inBounds(bird.pos, newDir);
                this.speed(newDir, predSpeed)

                let newPos = bird.pos.add(newDir.scaleUp(timestep));
            
                newBirds.push(new Bird(newPos, newDir, true, false));
                ret.push([newPos, newDir, true, false]);
            } else {
                let avgPos = new vec3(0, 0, 0);
                let sepDir = new vec3(0, 0, 0);
                let avoidDir = new vec3(0, 0, 0);
                let avgDir = new vec3(0, 0, 0);

                let numInRange = 0;
                for (let b of this.birds){
                    let dist = b.pos.distance(bird.pos);
                    if (dist <= visualRange) {
                        if (b.predator) {
                            // this is bird, other is predator
                            avoidDir.updateAdd(bird.pos.subtract(b.pos).updateNormalize().scaleUp(visualRange / dist));
                        } else {
                            // both are birds
                            if (dist < 2 * separation ** 2) {           // Arbitary num
                                sepDir.updateAdd(bird.pos.subtract(b.pos))
                            }
                            avgPos.updateAdd(b.pos);
                            avgDir.updateAdd(b.dir);
                            numInRange += 1;
                        }
                    }
                }

                if (numInRange !== 0) {
                    avgPos.updateScaleDown(numInRange)
                    avgDir.updateScaleDown(numInRange);
                }

                let newDir = avgPos.updateSubtract(bird.pos).updateScaleUp(cohesion);
                newDir.updateAdd(sepDir.updateScaleUp(separation));
                newDir.updateAdd(avoidDir.updateScaleUp(fear * 20));
                newDir.updateAdd(avgDir.updateScaleUp(alignment / 3));
                newDir.updateAdd(bird.dir.scaleUp(momentum * 5));
                
                if (useLight && light.distance(bird.pos) < visualRange * 4) {
                    newDir.updateAdd(light.subtract(bird.pos).updateScaleUp(lightAttraction));
                }

                this.inBounds(bird.pos, newDir);
                this.speed(newDir)

                let newPos = bird.pos.add(newDir.scaleUp(timestep));
            
                newBirds.push(new Bird(newPos, newDir, false, bird.dead));
                ret.push([newPos, newDir, false, bird.dead]);
            }
        }

        this.birds = newBirds;

        return ret;
    }
}

export {
    vec3,
    FlockingSim
}