require('dotenv').config();

const express = require('express');
const axios = require('axios');
const app = express();

// Fetch the Storyblok API token from the environment
const STORYBLOK_API_TOKEN = process.env.STORYBLOK_API_TOKEN;

// Load the website map from Storyblok
let websiteMap = {};

const loadWebsiteMap = async () => {
  try {
    const response = await axios.get(
      `https://api.storyblok.com/v2/cdn/stories/settings/websitemap/websites?token=${STORYBLOK_API_TOKEN}`
    );
    websiteMap = response.data.story.content.items.reduce((map, story) => {
      const { developmentURL, productionURL } = story;
      map[story.folder] = { developmentURL, productionURL };
      return map;
    }, {});
    console.log("Website map loaded:", websiteMap);
  } catch (error) {
    console.error("Failed to load website map:", error);
  }
};

// Load the website map at startup
loadWebsiteMap();

// Middleware to proxy requests based on the website map
app.use('/:environment/:language([a-z]{2}-[a-z]{2})?/:website/*', async (req, res, next) => {
  const { environment, language, website } = req.params;
  const remainingPath = req.params[0];

  // Map the 'preview' environment to 'development'
  const resolvedEnvironment = environment === 'preview' ? 'development' : environment;

  // Validate environment and website
  if (!websiteMap[website]) {
    return res.status(404).send(`Website '${website}' not found in the website map.`);
  }

  const targetEnv = websiteMap[website][`${resolvedEnvironment}URL`];
  if (!targetEnv) {
    return res.status(400).send(`Invalid environment '${resolvedEnvironment}' for website '${website}'.`);
  }

  // Construct the target URL
  const targetURL = `${targetEnv}/${language ? language + '/' : ''}${website}/${remainingPath}`;

  console.log(`Proxying to ${targetURL}`);

  // Proxy the request
  try {
    const proxyResponse = await axios({
      method: req.method,
      url: targetURL,
      headers: {
        'User-Agent': req.headers['user-agent'], // Include User-Agent
        'Accept': req.headers['accept'], // Forward Accept header
        'Content-Type': req.headers['content-type'], // Forward Content-Type
      },
      params: req.query, // Forward query parameters if any
      data: req.body, // Forward request body for POST/PUT requests
    });

    res.status(proxyResponse.status).send(proxyResponse.data);
  } catch (error) {
    console.error("Proxy error:", error.response?.data || error.message);
    let errorMessage = error.response?.data || "Internal Server Error";
    errorMessage += ` Target URL: ${targetURL}`; // Append targetURL to the error message.
    res.status(error.response?.status || 500).send(errorMessage);
  }

});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});