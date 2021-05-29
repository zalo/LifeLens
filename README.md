# [LifeLens](https://zalo.github.io/LifeLens/)

<p align="left">
  <a href="https://github.com/zalo/LifeLens/deployments/activity_log?environment=github-pages">
      <img src="https://img.shields.io/github/deployments/zalo/LifeLens/github-pages?label=Github%20Pages%20Deployment" title="Github Pages Deployment"></a>
  <a href="https://github.com/zalo/LifeLens/commits/master">
      <img src="https://img.shields.io/github/last-commit/zalo/LifeLens" title="Last Commit Date"></a>
  <a href="https://github.com/zalo/LifeLens/blob/master/LICENSE">
      <img src="https://img.shields.io/github/license/zalo/LifeLens" title="License: Apache V2"></a>
</p>

 A quick and _extremely_ dirty test for reading facial bloodflow via webcam (eventually for detecting heartrate).

[![Lifelens Demo](LifeLens.gif)](https://zalo.github.io/LifeLens/)

## Basic Algorithm
 - Get a Bounding Box of the Face
 - Average up the R and G components of all the pixels in the box
 - Divide the Red Channel by the Green Channel
 - Crop to a fixed range and add filtering

 ## Limitations
 - Needs strong ambient illumination
 - Results may be skin color dependent

 ## Credits
 - [three.js](https://github.com/mrdoob/three.js/) (3D Rendering Engine)
 - [Mediapipe Facemesh](https://github.com/tensorflow/tfjs-models/tree/master/face-landmarks-detection) (Face Tracking)
