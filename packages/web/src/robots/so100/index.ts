import { LeRobotRobotBase } from "../base";
import { LoadingManager } from 'three';
import URDFLoader, { URDFRobot } from 'urdf-loader';

export class LeRobotSO100 extends LeRobotRobotBase {
    constructor() {
        super();
    }

    public async loadURDF(): Promise<URDFRobot> {
        const loadingManager = new LoadingManager();
        const loader = new URDFLoader(loadingManager);
        const robot = await loader.loadAsync('https://cdn.jsdelivr.net/gh/timqian/bambot@eba23eb/website/public/URDFs/so101.urdf')
        console.log("joints", robot.joints)
        return robot
    }

    /**
     * Sets joint values for the robot
     * @param jointValues Dictionary of joint names to joint values
     */
    public setJoints(jointValues: Record<string, number>): void {
        if (this.urdfContent) {
            this.urdfContent.setJointValues(jointValues);
        } else {
            throw new Error("robot not initialized")
        }
    }

    protected simulationStep(deltaTime: number): void {
        // Perform simulation step
        this.simulationStep(deltaTime);
    }
}