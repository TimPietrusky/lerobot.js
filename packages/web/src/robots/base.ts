import { WebTeleoperator } from '../teleoperators/base-teleoperator';
import { URDFRobot } from 'urdf-loader';

/**
 * Abstract base class for robots in the LeRobot system.
 * Provides common functionality for robot control, connection, and simulation.
 */
export abstract class LeRobotRobotBase {
  protected initialized: boolean = false;
  protected urdfLoaded: boolean = false;
  protected urdfContent: URDFRobot | null = null;
  protected leaderTeleoperator: WebTeleoperator | null = null;
  protected followerTeleoperator: WebTeleoperator | null = null;

  /**
   * Constructor for the robot base class
   */
  constructor() {
    this.initialized = false;
    this.urdfLoaded = false;
    this.urdfContent = null;
  }

  /**
   * Connect a leader teleoperator to this robot
   * The leader will control the robot's movements
   * 
   * @param teleoperator The teleoperator to connect as leader
   */
  public connectLeader(teleoperator: any): void {
    this.leaderTeleoperator = teleoperator;
  }

  /**
   * Connect a follower teleoperator to this robot
   * The follower will mirror the robot's movements
   * 
   * @param teleoperator The teleoperator to connect as follower
   */
  public connectFollower(teleoperator: any): void {
    this.followerTeleoperator = teleoperator;
  }

  /**
   * Initialize the robot
   * This method must be called before using the robot
   * It loads the URDF and sets up any necessary resources
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('Robot already initialized');
      return;
    }

    try {
      // Load the URDF
      await this.initializeURDF();
      
      // Additional initialization steps can be implemented by derived classes
      await this.initializeAdditionalResources();
      
      this.initialized = true;
      console.log('Robot initialized successfully');
    } catch (error) {
      console.error('Failed to initialize robot:', error);
      throw error;
    }
  }

  /**
   * Initialize the URDF for the robot
   * This loads the robot's description file
   */
  public async initializeURDF(): Promise<void> {
    if (this.urdfLoaded) {
      return;
    }

    try {
      // This method should be overridden by derived classes to load the specific URDF
      this.urdfContent = await this.loadURDF();
      this.urdfLoaded = true;
      console.log('URDF loaded successfully');
    } catch (error) {
      console.error('Failed to load URDF:', error);
      throw error;
    }
  }

  /**
   * Load the URDF content
   * This method must be implemented by derived classes
   */
  public abstract loadURDF(): Promise<URDFRobot>;

  /**
   * Initialize any additional resources needed by the robot
   * This method can be overridden by derived classes
   */
  public async initializeAdditionalResources(): Promise<void> {
    // Default implementation does nothing
    // Derived classes can override this to initialize additional resources
  }

  /**
   * Simulate the robot for visualization or physics engines
   * This method should be called in the animation loop
   * 
   * @param deltaTime Time elapsed since the last simulation step in seconds
   */
  public simulate(deltaTime: number): void {
    if (!this.initialized) {
      console.warn('Cannot simulate: Robot not initialized');
      return;
    }

    // Perform simulation step
    this.simulationStep(deltaTime);
  }

  /**
   * Perform a simulation step
   * This method should be implemented by derived classes
   * 
   * @param deltaTime Time elapsed since the last simulation step in seconds
   */
  protected abstract simulationStep(deltaTime: number): void;

  /**
   * Get the URDF content
   * @returns The URDF content as a string, or null if not loaded
   */
  public getURDF(): URDFRobot | null {
    return this.urdfContent;
  }

  /**
   * Check if the robot is initialized
   * @returns True if the robot is initialized, false otherwise
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
}
