console.log("IT'S ALIVE!");

function $ (selector, context = document) {
  return context.querySelector(selector);
}

function $$ (selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// Step 3: Automatic navigation menu
let nav = document.createElement("nav");
document.body.prepend(nav);

let pages = [
  {url: "", title: "Home"},
  {url: "projects/", title: "Projects"},
  {url: "contact/", title: "Contact"},
  {url: "cv/", title: "CV"},
  {url: "https://github.com/preciseeagle", title: "GitHub"},
];

const ARE_WE_HOME = document.documentElement.classList.contains("home");

for (let p of pages) {
  let url = p.url;
  let title = p.title;
  let a = document.createElement("a");

  a.textContent = title;
  url = !ARE_WE_HOME && !url.startsWith("http") ? "../" + url : url;
  a.href = url;

  if (a.host !== location.host) {
    a.target = "_blank";
  }
  else {
    // Local link
    if (a.pathname === location.pathname) {
      a.classList.add("current");
    }
  }

  nav.appendChild(a);
}

// Step 4: Dark mode switcher
document.body.insertAdjacentHTML("afterbegin", `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
`);

let select = document.querySelector("select");
select.addEventListener("input", event => {
  setColorScheme(event.target.value);
});

function setColorScheme (colorScheme) {
  select.value = colorScheme;
  document.documentElement.style.setProperty("color-scheme", colorScheme);
  localStorage.colorScheme = colorScheme;
}

if (localStorage.colorScheme) {
  setColorScheme(localStorage.colorScheme);
}

// Step 5: Better contact form
let form = document.querySelector("form");
form?.addEventListener("submit", evt => {
  evt.preventDefault();
  let data = new FormData(form);
  let params = [];
  for (let [name, value] of data) {
    params.push(name + "=" + encodeURIComponent(value));
  }
  let url = form.action + "?" + params.join("&");
  location.href = url;
});

// Lab 4: Fetching JSON data
export async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching or parsing JSON data:", error);
  }
}

// Lab 4: Render projects from data
export function renderProjects(projects, containerElement, headingLevel = "h2") {
  if (!containerElement) {
    console.error("Invalid container element provided.");
    return;
  }

  containerElement.innerHTML = "";

  for (let project of projects) {
    const article = document.createElement("article");
    article.innerHTML = `
      <${headingLevel}>${project.title}</${headingLevel}>
      <img src="${project.image}" alt="${project.title}">
      <p>${project.description}</p>
    `;
    containerElement.appendChild(article);
  }
}

// Lab 4: Fetch GitHub data
export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}
