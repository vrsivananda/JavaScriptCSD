# JavaScript CSD

This is a JavaScript implementation of the CSD model outlined by Yi & Merfeld in their paper *[A quantitative confidence signal detection model: 1. Fitting psychometric functions](https://www.physiology.org/doi/10.1152/jn.00318.2015)*.

## Documentation

We need to include 3 scripts in the <head> element of the html file for CSD to work:
1. `<script src="csd.js"></script>`
    * This is the only file that is written by me. This is the core of the CSD model.
2. `<script src="jmat.js"></script>`
    * This is for many of the math optimization functions, obtained from Github user [jonasalmeida](https://github.com/jonasalmeida/jmat/blob/gh-pages/jmat.js)
3. `<script> var exports = {}; </script>`<br> 
   `<script src="MathFn/functions/erf.js"></script>`
    * The *exports* script above is also necessary for the erf.js functions to be exported into your html script
    * This is for the erf function, obtained from Github user [AndreasMadsen](https://github.com/AndreasMadsen/mathfn)

Also ensure that the .js files are located in an appropriate location for your html file to access them.

### Creating the CSD Object

To use the CSD model to estimate the psychometric function parameters (Mu and Sigma), you will first need to create a CSD object.

Example of creating a general CSD object (initialized with all default values):
```javascript
var myCSD = new csd();
```
The CSD object comes with certain default parameter values described in the table below. Instructions on how to modify the parameters are below the table. Parameter values do not have to be filled in if default values are acceptable.

|Parameter|Type|Default Value| Descripton|
|---------|----|-------------|-----------|
|`number_of_iterations`|numeric|10000|The number of iterations for the fminsearch function in all optimization procedures.|
|`display_iterations`|boolean|false|If true, then fminsearch will display its iterations during optimization. If false, nothing is displayed.|
|`initial_guess_mu`|numeric|0|The initial value of Mu to begin optimization. Ideally, this should be as close to what you expect as possible.|
|`initial_guess_sigma`|numeric|1|The initial value of Sigma to begin optimization. Ideally, this should be as close to what you expect as possible.|
|`initial_guess_k`|numeric|1|The intial value of k to begin optimization. This is can be left as 1 under most circumstances.|
|`confidence_resolution`|numeric|0.01|The resolution of the confidence judgment. I.e. the smallest possible increment from one confidence judgment to another. This is used to determine the bin size when the CSD model runs.|
|`confidenceMidpoint`|numeric|0.5|The point in the confidence judgment that demarcates the binary judgment. E.g. if 0.5, then during the binary psychometric function fitting, confidence judgments that are < 0.5 will be converted to 0, while confidence judgments that are >= 0.5 will be converted to 1.|

To modify the parameters, simply create an object with the parameters as keys and the new value as values, then pass the object into the CSD constructor.

Example of creating a CSD object with modified parameters:
```javascript
//Create a parameter object
var myParameters = {
	number_of_iterations: 5000,
	confidence_resolution: 0.05
};

//Pass it into the CSD constructor as an argument
var myCSD = new csd(myParameters);
```

### Passing in data to the CSD Object

Once the CSD object is created, you will need to pass in data to the CSD object.

There are two ways of doing this:

#### (1) Trial-by-trial
You can pass in data trial-by-trial with the CSD object's `addData` method. The method accepts two arguments: the confidence judgment, and the stimulus intensity.
```javascript
//Example confidence judgment and stimulus intensity
var confidenceJudgment = 0.9;
var stimulusIntensity = 0.7;

//Add in the data to the CSD object
myCSD.addData(confidenceJudgment, stimulusIntensity); 
```
You can keep adding the confidence judgment and stimulus intensity trial-by-trial as the CSD object will keep track of the confidence judgments and stimulus intensities through an internal array.

#### (2) All at once:
Alternatively, you can pass in data all at once using the same `addData` method.
```javascript
//Example confidence judgment and stimulus intensity arrays
var confidenceJudgmentArray = [0.9, 0.2, 0.5, 0.3, 0.2, 0.8, 0.6];
var stimulusIntensityArray = [0.7, -0.4, 0.1, -0.4, -0.5, 0.5, 0.4];

//Add in the data array to the CSD object
myCSD.addData(confidenceJudgmentArray, stimulusIntensityArray);
```


## Running the CSD model

Once you have all the data loaded into the CSD object, you can run the `startCSD` method to get the estimates of Mu and Sigma from the CSD model.

It will output an array with three elements: Mu, Sigma, and K.
All three elements are the final parameters found by the CSD model.

```javasript
//Start the CSD method
[Mu, Sigma, K] = myCSD.startCSD();
```

