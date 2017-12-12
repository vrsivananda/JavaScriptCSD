function csd(dataObject){
	
	//If there is not dataObject, then use an empty dataObject
	if(dataObject == undefined){
		dataObject = {};
	}
	
	//Optimization parameters
	var numberOfIterations = dataObject.number_of_iterations || 10000;//Number of iterations for the jmat fminsearch procedure
	var error = 0.0000000000000001; //How much to subtract/add to avoid infinity in the psychometric function (e.g. y = 1 or y = 0, then x = infinity or y = -infinity)
	var displayIterations = dataObject.display_iterations || false;


	//-----CSD stuff------
	
	//Parameters
	var initialGuessMean = dataObject.initial_guess_mu || 0;
	var initialGuessSlope = (1/dataObject.initial_guess_sigma) || 1;
	var initialGuessK = dataObject.initial_guess_k || 1;
	var binSize = dataObject.confidence_resolution || 0.01;
	var confidenceMidpoint = dataObject.confidence_midpoint || 0.5;
	
	//Arrays
	var confidenceArray = [];
	var stimulusArray = [];
	
	//----------------------------------------------
	//-----------PRIVILEGED FUNCTIONS---------------
	//----------------------------------------------
	
	//Function to add data to our arrays at every trial
	this.addData = function(confidenceResponse, stimulusLevel){
		//Step A: Record data
		
		//Push the confidence response and stimulus level for this trial into their respective arrays
		stimulusArray.push(stimulusLevel);
		confidenceArray.push(confidenceResponse);
	}
	
	plotPoints(stimulusArray,confidenceArray);
	
	//Function to start the CSD procedure
	this.startCSD = function(newConfidenceArray = "noData", newStimulusArray = "noData"){
		
		//If the user passed in the data for the confidence array, then we use those arrays
		if(newConfidenceArray !== "noData" || newStimulusArray !== "noData"){
			confidenceArray = newConfidenceArray;
			stimulusArray = newStimulusArray;
		}
		
		//Make the confidence judgment into a binary forced-choice judgment and store it in an array
		var binaryArray = makeBinary(confidenceArray);
		
		//Step B: fit binary data
		var meanAndSlope = findMeanAndSlope(stimulusArray, binaryArray, [initialGuessMean, initialGuessSlope]);
		console.log("meanAndSlope: ");
		console.log(meanAndSlope);
		
		var mean = meanAndSlope[0];
		var slope = meanAndSlope[1];
		
		//Step C: fit the confidence data
		var k = findK(stimulusArray, confidenceArray, [mean, slope], initialGuessK)[0];
		console.log("k: ");
		console.log(k);
		
		plotCurve([mean,slope/k]);
		
		//Step D: Set CjUpper and CjLower
		var CjArray = makeCjArray(confidenceArray, binSize);
		
		//Step E: Choose initial values
		//Values chosen above
		
		//Steps F to I: Maximize the log likelihood
		var finalizedParameters = maximizeLogLikelihood(CjArray,[mean,slope,k], stimulusArray);
		console.log("finalizedParameters: ");
		console.log(finalizedParameters);
		
		var finalMean = finalizedParameters[0];
		var finalSlope = finalizedParameters[1];
		var finalK = finalizedParameters[2];
		
		//Return the parameters in the form of [finalMu, finalSigma, finalK]
		return [finalMean, 1/finalSlope, finalK];
				
	}//End of this.startCSD method
	
	
	//-----------------------------------------------------------
	//-----------PRIVATE FUNCTIONS BELOW THIS LINE---------------
	//-----------------------------------------------------------
	
	
	
	//--------------------------
	//---Optimizing Functions---
	//--------------------------
	
	//Function to find mean and slope with the cumulative gaussian function
	//Output == [mean, slope]
	function findMeanAndSlope(xArray,yArray,[initialGuessMean, initialGuessSlope] = [0.5,1]){
		
		//Load in parameters for easy handling
		var alpha = initialGuessMean;
		var beta = initialGuessSlope;
		var gamma = 0; //Set to zero because pegged that way in the methods
		var lambda = 0; //Set to zero because pegged that way in the methods
		
		console.log("coherence:");
		console.log(xArray);
		console.log("confidenceJudgment");
		console.log(yArray);
		
		//The psychometric fit function for cumulative gaussian to obtain the mean and slope
		function cumulativeGaussianFunctionForMeanAndSlope (xArray,[alpha,beta]){
		//	console.log("mean: " + alpha);
		//	console.log("slope: " + beta);
			return xArray.map(
				function(xValue){
					return ( gamma+(1-lambda-gamma)*0.5*(erfc((-beta)*(xValue-alpha)/Math.sqrt(2))) );
				}
			);
		}
		
		//Calculate the parameters with fminsearch
		var optimizedMeanAndSlope = jmat.fminsearch(cumulativeGaussianFunctionForMeanAndSlope,[alpha, beta],xArray,yArray,{maxIter:numberOfIterations, display: displayIterations});
		
		//Return the optimized mean and slope
		return optimizedMeanAndSlope;
			
	}//End of fitCumulativeGaussian
	
	
	//Function to find k (the scalar value) with the cumulative gaussian function
	//Output == optimizedK
	function findK(xArray, yArray, [mean, slope], initialGuessK = 1){
		
		//Load in parameters for easy handling
		var alpha = mean;
		var beta = slope;
		var gamma = 0; //Set to zero because pegged that way in the methods
		var lambda = 0; //Set to zero because pegged that way in the methods
		
		//The psychometric fit function for cumulative gaussian
		function cumulativeGaussianFunctionForK(xArray,[k]){
			return xArray.map(
				function(xValue){
					return ( gamma+(1-lambda-gamma)*0.5*(erfc((-beta/k)*(xValue-alpha)/Math.sqrt(2))) );
				}
			);
		}
		
		//Calculate the parameters with fminsearch
		var optimizedK = jmat.fminsearch(cumulativeGaussianFunctionForK,[initialGuessK],xArray,yArray,{maxIter:numberOfIterations, display: displayIterations});
		
		//Return the the optimized k
		return optimizedK;
		
	}//End of findK function
	
	
	//Function to maximize the log likelihood (Step I, which contains Steps F to H)
	//output == [mean, slope, k]
	function maximizeLogLikelihood(CjArray, [mean, slope, k], stimulusArray){
		
		function StepsFToH(CjArray,[mean,slope,k]){
		/*	console.log("k: " + k);
			console.log("mean: " + mean);
			console.log("slope: " + slope);
		*/
			//Step F: Calculate XjLower and XjUpper
			var XjArray = makeXjArray(CjArray, [mean, slope, k]);
			
			//Step G: Calculate probabilities
			var probabilitiesArray = calculateProbabilityForStepG(XjArray, stimulusArray, [mean,slope]);
			
			//Log likelihood
			var logLikelihood = sumLog(probabilitiesArray);
			
			//Return the array (because fminsearch requires an array)
			return [-logLikelihood];

		}//End of StepsFToH
		
		//Use the fminsearch to minimize sumLogLikelihood based on the initial values
		var optimizedParameters = jmat.fminsearch(StepsFToH,[mean, slope, k], CjArray, [0], {maxIter:numberOfIterations, display: displayIterations});
		
		//Return the optimized parameters
		return optimizedParameters;
		
	}//End of maximizeLogLikelihood
	
	
	//Function to fit the general cumulative gaussian function to x and y data
	//Output == [alpha, beta, gamma, lambda]
	function fitCumulativeGaussian(xArray,yArray,initialGuessArray = [0.5,1,0,0]){
		
		//p is the initial guess array, for easy handling
		var p = initialGuessArray;
		
		/*
		Parameters and what they mean:
		p[0] = alpha  = bias/mean
		p[1] = beta   = slope
		p[2] = gamma  = guess rate
		p[3] = lambda = lapse rate
		*/
		//The psychometric fit function for cumulative gaussian to obtain all 4 parameters
		function cumulativeGaussianFunctionGeneral(xArray,p){
			return xArray.map(
				function(xValue){
					return ( p[2]+(1-p[2]-p[3])*0.5*(erfc((-p[1])*(xValue-p[0])/Math.sqrt(2))) );
				}
			);
		}
		
		//Calculate the parameters with fminsearch
		var optimizedParameters = jmat.fminsearch(cumulativeGaussianFunctionGeneral,[0.5,1,0,0],xArray,yArray,{maxIter:numberOfIterations, display: displayIterations});
		
		//Return the parameters
		return optimizedParameters;
			
	}//End of fitCumulativeGaussian
	
	
	//---------------------------
	//---Calculating Functions---
	//---------------------------
	
	
	//Function to calculate the Xj through the inverse confidence function
	//Output == Xj
	function calculateXj(Cj,[mean, slope, k]){
		
		var alpha = mean;
		var beta = slope/k;
		var gamma = 0; //Set to zero because pegged that way in the methods
		var lambda = 0; //Set to zero because pegged that way in the methods
		
		//Calculate the Xj given the Cj
		var Xj = invErfc(2*((Cj-gamma)/(1-gamma-lambda)))*(Math.sqrt(2)/(-beta)) + alpha;
		
		return Xj; 
		
	}//End of calculateXj
	
	
	//Function to find the probability between two points on the gaussian function using the cumulative gaussian function
	//output == probability
	function calculateProbabilityBetween(x1, x2, [mean, slope]){
		
		var alpha = mean;
		var beta = slope;
		var gamma = 0; //Set to zero because pegged that way in the methods
		var lambda = 0; //Set to zero because pegged that way in the methods
		
		//Find the difference between the probability of both 
		var probability = calculateProbabilityFromCumulativeGaussian(x1, [mean,slope]) - calculateProbabilityFromCumulativeGaussian(x2, [mean,slope]);
		
		
		//Return the positive probability (because x1 and x2 might be in opposite order)
		return Math.abs(probability);
		
	}//End of calculateProbabilityBetween 
	
	//Function to calculate the y (probability) value from the cumulative gaussian
	function calculateProbabilityFromCumulativeGaussian(x,[mean, slope]){
		
		var alpha = mean;
		var beta = slope;
		var gamma = 0; //Set to zero because pegged that way in the methods
		var lambda = 0; //Set to zero because pegged that way in the methods
		
		return lambda + (1-lambda-gamma)*0.5*erfc((-beta*(x-alpha))/Math.sqrt(2));
		
	}//End of calculateProbabilityFromCumulativeGaussian
	
	
	
	
	//Function to calculate the probability of this specific confidence probability judgment given the fitted psychometric function (Step G)
	//Output == probabilitiesArray
	function calculateProbabilityForStepG(XjArray, stimulusArray, [mean,slope]){
		
		//Declare an array to hold the probabilities
		var probabilitiesArray = [];
		
		//Loop through the arrays to get the probabilities
		for(var i = 0; i < XjArray.length; i++){
			
			//Set up the variables to be passed into the function
			var newMean = mean + stimulusArray[i];
			
			//Calculate the probability
			var probability = calculateProbabilityBetween(XjArray[i].XjUpper, XjArray[i].XjLower,[newMean, slope]);
			
			//Push the probability into the probability array
			probabilitiesArray.push(probability);
		}
		
		//Return the array
		return probabilitiesArray;
		
	}//End of calculateProbabilityForStepG
	
	
	//----------------------------
	//---Housekeeping Functions---
	//----------------------------
	
	
	//Function to set bins for the confidence judgments
	function makeCjArray(confidenceArray, binSize){
		
		//Create an array to hold the object with bins
		var CjArray = [];
		
		//Loop through the confidence Array and designate the bins
		for(var i = 0; i < confidenceArray.length; i++){
			
			//Store the original confidence judgment
			var originalConfidenceJudgment = confidenceArray[i]
			
			//If the confidence judgments are at the limits, bring them back in to bin them fully
			if(originalConfidenceJudgment - binSize/2 < 0){
				var newConfidenceJudgment = 0 + binSize/2 + error;
			}
			else if(originalConfidenceJudgment + binSize/2 > 1){
				var newConfidenceJudgment = 1 - binSize/2 - error;
			}
			else{
				var newConfidenceJudgment = originalConfidenceJudgment;
			}
			
			//Set the bin limits
			var upperBinLimit = newConfidenceJudgment + binSize/2;
			var lowerBinLimit = newConfidenceJudgment - binSize/2;
			
			//Store it in an object
			var CjObject = {
				confidenceResponse: originalConfidenceJudgment,
				CjUpper: upperBinLimit,
				CjLower: lowerBinLimit
			};
			
			//Push the object with all the info into the bin Array
			CjArray.push(CjObject);
		}
		
		//Return the array
		return CjArray;
		
	}//End of makeCjArray
	
	//Function to make the XjArray from the CjArray (Step F)
	function makeXjArray(CjArray,[mean, slope, k]){
		
		var mean = 0; //Set to zero because pegged that way in the methods
		
		//Declare an XjArray to hold the Xj Objects
		var XjArray = []
		
		//Loop throught he bins Array to get the Xj values
		for (var i = 0; i < CjArray.length; i++){
			
			//Find the Xj upper and lower
			var XjUpper = calculateXj(CjArray[i].CjUpper, [mean, slope, k]);
			var XjLower = calculateXj(CjArray[i].CjLower, [mean, slope, k]);
			
			//Put them in an object
			var XjObject = {
				XjLower: XjLower,
				XjUpper: XjUpper
			};
			
			//Push it into the array
			XjArray.push(XjObject);
		}
		
		//Return the array
		return XjArray;
		
	} //End of calculateXjArray
	
	//Function to sum up the logarithm of all the probabilities (Step H)
	function sumLog(probabilitiesArray){
	
		//Sum up the log of all the elements in the array
		var sum = probabilitiesArray.reduce(
			function(accumulator, element){
				return accumulator + Math.log(element);
			}, 0);
		
		//Return the sum
		return sum;
	
	}//End of sumLog
	
	//Function to make fake data to test the procedure
	function makeConfidenceAndStimulusArrays([minRange, maxRange], [mean, slope]){
		
		//Declare arrays to store the data and return later
		var confidenceArray = [];
		var stimulusArray = [];
		
		//Loop through each time and make a data point
		for (var i = 0; i < numberOfDataPoints; i++){
			
			//Make a random x value in the range
			var x = Math.random()*(maxRange - minRange) + minRange;
			
			//Find the y value for the X
			var y = calculateProbabilityFromCumulativeGaussian(x,[mean,slope]);
			
			y = Math.random() > 0.5 ? y-(Math.random()*noise) : y+(Math.random()*noise);
			
			while(y < 0 || y > 1){
				y = Math.random() > 0.5 ? y-(Math.random()*noise) : y+(Math.random()*noise);
			}
			
			//Push the values into the arrays
			confidenceArray.push(y);
			stimulusArray.push(x);
			
		}
		
		//Return them as a 2D array
		return [confidenceArray, stimulusArray];
		
	}//End of makeData
	
	function makeBinary(confidenceArray){
		
		//Declare an array to hold the binary data
		var binaryArray = []
		
		//Loop through the confidenceArray and make it binary
		for(var i = 0; i < confidenceArray.length; i++){
			
			//If the confidence is larger than 0.5, then data is 1, else it is 0
			var binaryData = confidenceArray[i] > confidenceMidpoint ? 1 : 0;
			
			//Push the data into the array
			binaryArray.push(binaryData);
			
		}
		
		//Return the array
		return binaryArray;
		
	}//End of makeBinary
	
	//Function to plot the points on the canvas
	function plotPoints(stimulusArray, confidenceArray){
		var canvas = document.getElementById("myCanvas");
		var ctx = canvas.getContext("2d");
		
		//Set size of canvas
		canvas.height = window.innerHeight;
		canvas.width = window.innerWidth;
		
		//Background
		ctx.fillStyle = "gray";
		ctx.fillRect(0,0, canvas.width, canvas.height);
		
		//Draw Axes
		ctx.beginPath();
		ctx.moveTo(2,0);
		ctx.lineTo(2,500);
		ctx.lineTo(500,500);
		ctx.stroke();
		
		//Plot points
		for(var i = 0; i < stimulusArray.length; i++){
			var x = (stimulusArray[i] + 1) * 5/2 * 100;
			//console.log("x: " + x);
			var y = -((confidenceArray[i]*500)-500);
			//console.log("y: " + y);
			
			ctx.beginPath();
			ctx.strokeStyle = "blue";
			ctx.arc(x,y,2,0,2*Math.PI);
			ctx.stroke();
		}
		
		console.log("points plotted.");
	}
	
			
	//Function to plot the curve on the canvas
	function plotCurve([mean, slope]){
		
		var alpha = mean;
		var beta = slope;
		var gamma = 0; //Set to zero because pegged that way in the methods
		var lambda = 0; //Set to zero because pegged that way in the methods
		
		//Make an evenly distributed x-array to be used to predict the y
		var newXArray = []
		for(var i = 0; i < 1000; i++){
			//x-value
			var x = (2*i/1000)-1;
			newXArray.push(x);
		}
		
		//Calculate the array of predicted y values based on the mean and slope
		var predictedYArray = newXArray.map(
				function(xValue){
					return ( gamma+(1-lambda-gamma)*0.5*(erfc((-beta)*(xValue-alpha)/Math.sqrt(2))) );
				}
			);
		
		var canvas = document.getElementById("myCanvas");
		var ctx = canvas.getContext("2d");
		
		//Draw the curve
		for(var i = 0; i < newXArray.length; i++){
			var x = (newXArray[i] + 1) * 5/2 * 100;
		//	console.log("x: " + x);
			var y = -((predictedYArray[i]*500)-500);
		//	console.log("y: " + y);
			
			ctx.beginPath();
			ctx.strokeStyle = "red";
			ctx.arc(x,y,1,0,2*Math.PI);
			ctx.stroke();
		}
		
	}//End of plotCurve
		
}//End of csd
