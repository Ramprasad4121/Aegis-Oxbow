import { ethers } from "ethers";

/**
 * A lightweight, pure-TS Feed-Forward Neural Network.
 * This directly replaces `brain.js` which fails to compile WebGL C++ bindings on modern Node versions.
 * It uses a simple 1-hidden-layer architecture with Sigmoid activation.
 */
class SimpleNeuralNetwork {
  private weightsInputHidden: number[][];
  private weightsHiddenOutput: number[][];
  private biasHidden: number[];
  private biasOutput: number[];
  
  private readonly learningRate = 0.1;

  constructor(private inputSize: number, private hiddenSize: number, private outputSize: number) {
    // Initialize weights and biases randomly between -1 and 1
    this.weightsInputHidden = Array.from({ length: inputSize }, () =>
      Array.from({ length: hiddenSize }, () => Math.random() * 2 - 1)
    );
    this.weightsHiddenOutput = Array.from({ length: hiddenSize }, () =>
      Array.from({ length: outputSize }, () => Math.random() * 2 - 1)
    );
    
    this.biasHidden = Array.from({ length: hiddenSize }, () => Math.random() * 2 - 1);
    this.biasOutput = Array.from({ length: outputSize }, () => Math.random() * 2 - 1);
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private sigmoidDerivative(x: number): number {
    return x * (1 - x);
  }

  public train(inputs: number[], expectedOutput: number[]) {
    // 1. Forward Pass
    // Input -> Hidden
    let hiddenOutputs: number[] = new Array(this.hiddenSize).fill(0);
    for (let j = 0; j < this.hiddenSize; j++) {
      let sum = this.biasHidden[j];
      for (let i = 0; i < this.inputSize; i++) {
        sum += inputs[i] * this.weightsInputHidden[i][j];
      }
      hiddenOutputs[j] = this.sigmoid(sum);
    }

    // Hidden -> Output
    let finalOutputs: number[] = new Array(this.outputSize).fill(0);
    for (let k = 0; k < this.outputSize; k++) {
      let sum = this.biasOutput[k];
      for (let j = 0; j < this.hiddenSize; j++) {
        sum += hiddenOutputs[j] * this.weightsHiddenOutput[j][k];
      }
      finalOutputs[k] = this.sigmoid(sum);
    }

    // 2. Backward Pass (Backpropagation)
    // Calculate output errors
    let outputErrors: number[] = new Array(this.outputSize);
    for (let k = 0; k < this.outputSize; k++) {
      const error = expectedOutput[k] - finalOutputs[k];
      outputErrors[k] = error * this.sigmoidDerivative(finalOutputs[k]);
    }

    // Calculate hidden errors
    let hiddenErrors: number[] = new Array(this.hiddenSize).fill(0);
    for (let j = 0; j < this.hiddenSize; j++) {
      let error = 0;
      for (let k = 0; k < this.outputSize; k++) {
        error += outputErrors[k] * this.weightsHiddenOutput[j][k];
      }
      hiddenErrors[j] = error * this.sigmoidDerivative(hiddenOutputs[j]);
    }

    // Update Weights and Biases
    // Hidden -> Output layer
    for (let j = 0; j < this.hiddenSize; j++) {
      for (let k = 0; k < this.outputSize; k++) {
        this.weightsHiddenOutput[j][k] += this.learningRate * outputErrors[k] * hiddenOutputs[j];
      }
    }
    for (let k = 0; k < this.outputSize; k++) {
      this.biasOutput[k] += this.learningRate * outputErrors[k];
    }

    // Input -> Hidden layer
    for (let i = 0; i < this.inputSize; i++) {
      for (let j = 0; j < this.hiddenSize; j++) {
        this.weightsInputHidden[i][j] += this.learningRate * hiddenErrors[j] * inputs[i];
      }
    }
    for (let j = 0; j < this.hiddenSize; j++) {
      this.biasHidden[j] += this.learningRate * hiddenErrors[j];
    }
  }

  public run(inputs: number[]): number[] {
    let hiddenOutputs: number[] = new Array(this.hiddenSize).fill(0);
    for (let j = 0; j < this.hiddenSize; j++) {
      let sum = this.biasHidden[j];
      for (let i = 0; i < this.inputSize; i++) {
        sum += inputs[i] * this.weightsInputHidden[i][j];
      }
      hiddenOutputs[j] = this.sigmoid(sum);
    }

    let finalOutputs: number[] = new Array(this.outputSize).fill(0);
    for (let k = 0; k < this.outputSize; k++) {
      let sum = this.biasOutput[k];
      for (let j = 0; j < this.hiddenSize; j++) {
        sum += hiddenOutputs[j] * this.weightsHiddenOutput[j][k];
      }
      finalOutputs[k] = this.sigmoid(sum);
    }
    return finalOutputs;
  }
}

export class AIGasPredictor {
  private net: SimpleNeuralNetwork;
  private isTrained = false;
  
  private historicalFees: number[] = [];
  private readonly windowSize = 10;

  constructor() {
    // 10 inputs (last 10 blocks), 5 hidden nodes, 1 output (confidence score)
    this.net = new SimpleNeuralNetwork(10, 5, 1);
  }

  public addBlockDataAndTrain(baseFeeWei: bigint): void {
    const gwei = parseFloat(ethers.formatUnits(baseFeeWei, "gwei"));
    
    this.historicalFees.push(gwei);
    if (this.historicalFees.length > this.windowSize) {
      this.historicalFees.shift();
    }

    if (this.historicalFees.length === this.windowSize) {
      this.trainModel();
    }
  }

  private trainModel(): void {
    const maxFee = Math.max(...this.historicalFees);
    const minFee = Math.min(...this.historicalFees);
    const range = maxFee - minFee || 1;

    const normalizedHistory = this.historicalFees.map(f => (f - minFee) / range);
    
    const avg = this.historicalFees.reduce((a, b) => a + b, 0) / this.windowSize;
    const currentFee = this.historicalFees[this.windowSize - 1];
    
    let targetScore = 0.5;
    if (currentFee < avg) {
       const dropRatio = (avg - currentFee) / avg;
       targetScore = Math.min(0.99, 0.5 + (dropRatio * 2)); 
    } else {
       const hikeRatio = (currentFee - avg) / avg;
       targetScore = Math.max(0.01, 0.5 - (hikeRatio * 2));
    }

    // Train heavily locally to find weights
    for (let i = 0; i < 200; i++) {
      this.net.train(normalizedHistory, [targetScore]);
    }

    this.isTrained = true;
  }

  public shouldExecuteBatch(currentFeeWei: bigint): [boolean, number] {
    if (!this.isTrained || this.historicalFees.length < this.windowSize) {
      return [false, 0];
    }

    const maxFee = Math.max(...this.historicalFees);
    const minFee = Math.min(...this.historicalFees);
    const range = maxFee - minFee || 1;

    const normalizedInput = this.historicalFees.map(f => (f - minFee) / range);

    const prediction = this.net.run(normalizedInput);
    const score = prediction[0] || 0;

    const execute = score > 0.7;

    return [execute, score];
  }

  public get isReady(): boolean {
      return this.isTrained;
  }
}
