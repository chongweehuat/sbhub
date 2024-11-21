const express = require('express');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 6788;
const HOST = '0.0.0.0';

// Storyblok API configuration
const STORYBLOK_API_TOKEN = 'H21xOvhGjQHp5kJXVOUsbwtt'; // Replace with your Storyblok API token
const STORYBLOK_WEBSITEMAP_FOLDER = 'websitemap'; // The folder containing website configurations
let websiteMap = {};

// Function to load the website map from Storyblok
async function loadWebsiteMap() {
  try {
    const response = await axios.get(
      `https://api.storyblok.com/v2/cdn/stories/websitemap/websites?token=${STORYBLOK_API_TOKEN}`
    );
    //console.log(response.data.story.content);
    // Parse the response and construct the website map
    websiteMap = response.data.story.content.items.reduce((map, story) => {
      const {developmentURL, productionURL} = story;
      map[story.folder] = { developmentURL, productionURL };
      return map;
    }, {});

    //console.log('Website map loaded:', websiteMap);
  } catch (error) {
    console.error('Error loading website map from Storyblok:', error.message);
  }
}

// Load the website map at server startup
loadWebsiteMap();

// Middleware to handle proxy requests
app.use('/:environment/:website/*', async (req, res, next) => {
  const { environment, website } = req.params; // Extract environment and website from URL
  const contentPath = req.params[0]; // Get the remaining path (e.g., "home")

  // Validate environment and website
  if (!['preview', 'production'].includes(environment)) {
    return res.status(400).send(`Invalid environment: ${environment}`);
  }

  const targetConfig = websiteMap[website];
  if (!targetConfig) {
    return res.status(404).send(`Website '${website}' not found.`);
  }

  // Determine the target URL based on the environment
  const targetBaseUrl = environment === 'preview' ? targetConfig.developmentURL : targetConfig.productionURL;

  // Proxy the request directly to the target URL
  createProxyMiddleware({
    target: targetBaseUrl,
    changeOrigin: true,
    pathRewrite: {
      [`^/${environment}/${website}`]: '' // Strip `/production/<website>` or `/preview/<website>` from the path
    }
  })(req, res, next);
});

// Start the Express server
app.listen(PORT, HOST, () => {
  console.log(`Proxy server is running on http://${HOST}:${PORT}`);
  console.log('Use "/preview/<website>" or "/production/<website>" to route requests.');
});
