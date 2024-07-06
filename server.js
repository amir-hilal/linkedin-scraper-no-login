const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio'); // Import cheerio
const fs = require('fs'); // Import the fs module

const app = express();
const PORT = process.env.PORT || 3000;

function getProxyAgent() {
  // Implement proxy agent logic here if needed
  return undefined;
}

async function getJob(id) {
  try {
    const response = await fetch(
      `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`,
      {
        agent: getProxyAgent(),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          accept: '*/*',
          'accept-language': 'en-US,en;q=0.9',
          'csrf-token': 'ajax:8807779655016041589',
          'sec-ch-ua':
            '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          Referer:
            'https://www.linkedin.com/jobs/engineering-jobs-beirut?trk=homepage-basic_suggested-search&position=1&pageNum=0',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
        body: null,
        method: 'GET',
      }
    );

    const html = await response.text();
    const $ = cheerio.load(html);
    const postedTimeAgo = $('.posted-time-ago__text').text().trim();
    const numberOfApplicants = $('.num-applicants__caption').text().trim();
    let jobDescription = $('.show-more-less-html__markup')?.html();

    // Replace all <ul> with new lines and <li>s to *
    jobDescription = jobDescription
      ?.replaceAll('<br>', '\n')
      ?.replaceAll('<ul>', '\n')
      ?.replaceAll('</ul>', '\n')
      ?.replaceAll('<li>', '* ')
      ?.replaceAll('</li>', '\n');

    const $1 = cheerio.load(jobDescription);
    jobDescription = $1.text().trim();

    const company = $('.topcard__org-name-link').text().trim();
    const location = $('.topcard__flavor--bullet')
      .first()
      .text()
      .trim()
      .replaceAll('\n', '')
      .replaceAll(',', '');

    const title = $('.topcard__title').text().trim();
    const link = $('.topcard__org-name-link').attr('href');
    const criteria = $('.description__job-criteria-item');
    console.log('criteria', criteria.length);
    const criteriaJson = [];
    criteria.each((i, item) => {
      const title = $(item)
        .find(".description__job-criteria-subheader")
        .text()
        .trim();
      const value = $(item)
        .find(".description__job-criteria-text--criteria")
        .text()
        .trim();
      criteriaJson.push({ title, value });
    });

    return {
      id,
      criteria: criteriaJson,
      company,
      location,
      title,
      link,
      postedTimeAgo,
      numberOfApplicants,
      description: jobDescription,
    };

  } catch (error) {
    console.log('error searching jobs', error.message);
    return null;
  }
}

async function searchJobs(term, page = 1) {
  const offset = (page - 1) * 25;
  try {
    const response = await fetch(
      `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(
        term
      )}&location=Beirut%2C%20Beirut%20Governorate%2C%20Lebanon&start=${offset}`,
      {
        headers: {
          accept: '*/*',
          'accept-language': 'en-US,en;q=0.9',
          'csrf-token': 'ajax:8807779655016041589',
          'sec-ch-ua':
            '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          Referer:
            'https://www.linkedin.com/jobs/engineering-jobs-beirut?trk=homepage-basic_suggested-search&position=1&pageNum=0',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
        body: null,
        method: 'GET',
      }
    );

    const html = await response.text();
    const $ = cheerio.load(html);
    const json = [];
    const jobs = $('.job-search-card');
    jobs.each((i, job) => {
      const id = $(job).attr('data-entity-urn')?.split(':')[3];
      const title = $(job).find('.base-search-card__title')?.text()?.trim();
      const company = $(job)
        .find('.base-search-card__subtitle')
        ?.text()
        ?.trim();
      const link = $(job).find('a').attr('href')?.split('?')[0];
      const location = $(job).find('.job-search-card__location').text()?.trim();
      json.push({ id, link, title, company, location });
    });
    return json;
  } catch (error) {
    console.log('error searching jobs', error.message);
    return [];
  }
}

app.get('/scrape/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const jobs = await searchJobs(key, 1);
    console.log(jobs);
    const jobDetailsPromises = jobs.map(async job => await getJob(job?.id));
    const jobDetails = await Promise.all(jobDetailsPromises);

    // Save job details to a JSON file
    fs.writeFileSync('jobs.json', JSON.stringify(jobDetails, null, 2));

    res.json(jobDetails);
  } catch (error) {
    console.error('Error fetching LinkedIn job:', error);
    res.status(500).send('Error fetching LinkedIn job');
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
