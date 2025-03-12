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

// Redirect route
app.use('/:environment/:language([a-z]{2}-[a-z]{2})?/:website/*', (req, res, next) => {
  const { environment, language, website } = req.params;
  const remainingPath = req.params[0]; // e.g., "aboutus"

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

  // Construct the target URL for redirection
  let targetURL = `${targetEnv}/${language ? language + '/' : ''}${website}/${remainingPath}`;

  // Append query strings if they exist
  const queryString = new URLSearchParams(req.query).toString();
  if (queryString) {
    targetURL += `?${queryString}`;
  }

  //console.log(`Redirecting to ${targetURL}`);

  // Perform a 302 redirect
  res.redirect(302, targetURL);
});

// Start the Express server
const PORT = process.env.PORT || 6788; // Use port 6788 as specified
app.listen(PORT, () => {
  console.log(`Redirect server running on port ${PORT}`);
});