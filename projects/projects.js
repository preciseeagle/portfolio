import { fetchJSON, renderProjects } from "../global.js";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

const projects = await fetchJSON("../lib/projects.json");
const projectsContainer = document.querySelector(".projects");
const projectsTitle = document.querySelector(".projects-title");
const searchInput = document.querySelector(".searchBar");

const svg = d3.select("#projects-pie-plot");
const legend = d3.select(".legend");
const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
const sliceGenerator = d3.pie().sort(null).value((d) => d.value);
const colors = d3.scaleOrdinal(d3.schemeTableau10);

let query = ""; // current search text
let selectedYear = null; // year selected by clicking a wedge/legend (null = none)

// Projects matching the search box; this drives the pie chart.
function searchedProjects() {
  if (!query) return projects;
  const q = query.toLowerCase();
  return projects.filter((p) =>
    Object.values(p).join("\n").toLowerCase().includes(q),
  );
}

function setProjectCount(n) {
  if (projectsTitle) {
    projectsTitle.textContent = `Projects (${n})`;
  }
}

function renderPieChart(projectsGiven) {
  // Group projects by year -> [{ value: count, label: year }], oldest first.
  const data = d3
    .rollups(
      projectsGiven,
      (v) => v.length,
      (d) => d.year,
    )
    .sort((a, b) => d3.ascending(a[0], b[0]))
    .map(([year, count]) => ({ value: count, label: year }));

  const arcData = sliceGenerator(data);

  // Wedges (data-join handles clearing/redrawing as the data changes).
  svg
    .selectAll("path")
    .data(arcData)
    .join("path")
    .attr("d", (d) => arcGenerator(d))
    .attr("fill", (d, i) => colors(i))
    .attr("class", (d) => (d.data.label === selectedYear ? "selected" : null))
    .on("click", (event, d) => toggleYear(d.data.label));

  // Legend
  legend
    .selectAll("li")
    .data(data)
    .join("li")
    .attr("style", (d, i) => `--color:${colors(i)}`)
    .attr("class", (d) =>
      d.label === selectedYear ? "legend-item selected" : "legend-item",
    )
    .html((d) => `<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
    .on("click", (event, d) => toggleYear(d.label));
}

// Toggle a year selection, then re-render everything through one path.
function toggleYear(year) {
  selectedYear = selectedYear === year ? null : year;
  update();
}

// Single source of truth: the search query and the wedge selection COMPOSE here.
// This fixes the Lab 5 Step 5.4 pitfall: a naive wedge click re-filtered the full
// `projects` array (discarding the active search). Here the list is always derived
// from the search result first, then narrowed by the selected year.
function update() {
  const searched = searchedProjects();
  renderPieChart(searched); // pie + legend reflect the search
  const shown = selectedYear
    ? searched.filter((p) => p.year === selectedYear)
    : searched;
  renderProjects(shown, projectsContainer, "h2"); // list reflects search AND year
  setProjectCount(shown.length);
}

searchInput?.addEventListener("input", (event) => {
  query = event.target.value;
  update();
});

update(); // initial render: pie, legend, and full project list
