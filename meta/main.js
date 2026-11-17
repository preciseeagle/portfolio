import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import scrollama from "https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm";

let xScale;
let yScale;
let commits;
let commitProgress = 100;
let commitMaxTime;
let filteredCommits;
const colors = d3.scaleOrdinal(d3.schemeTableau10);

async function loadData() {
  return d3.csv("loc.csv", (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + "T00:00" + row.timezone),
    datetime: new Date(row.datetime),
  }));
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const { author, date, time, timezone, datetime } = lines[0];
      const ret = {
        id: commit,
        url: "https://github.com/preciseeagle/portfolio/commit/" + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };
      // keep line rows off the logged object
      Object.defineProperty(ret, "lines", { value: lines });
      return ret;
    })
    .sort((a, b) => a.datetime - b.datetime);
}

function renderCommitInfo(data, commits) {
  const dl = d3.select("#stats").append("dl").attr("class", "stats");

  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (d) => d.line),
    (d) => d.file,
  );
  const longestFile = d3.greatest(fileLengths, (d) => d[1]);
  const workByDay = d3.rollups(
    data,
    (v) => v.length,
    (d) => d.datetime.toLocaleString("en", { weekday: "long" }),
  );
  const busiestDay = d3.greatest(workByDay, (d) => d[1])?.[0];

  const stats = [
    ['Total <abbr title="Lines of code">LOC</abbr>', data.length],
    ["Total commits", commits.length],
    ["Files", fileLengths.length],
    ["Longest file", `${longestFile[0]} (${longestFile[1]} lines)`],
    ["Average file length", d3.format(".1f")(d3.mean(fileLengths, (d) => d[1])) + " lines"],
    ["Maximum depth", d3.max(data, (d) => d.depth)],
    ["Busiest day", busiestDay],
  ];

  for (const [label, value] of stats) {
    dl.append("dt").html(label);
    dl.append("dd").text(value);
  }
}

function renderTooltipContent(commit) {
  if (Object.keys(commit).length === 0) return;

  const link = document.getElementById("commit-link");
  link.href = commit.url;
  link.textContent = commit.id;
  document.getElementById("commit-date").textContent =
    commit.datetime.toLocaleString("en", { dateStyle: "full" });
  document.getElementById("commit-time").textContent =
    commit.datetime.toLocaleString("en", { timeStyle: "short" });
  document.getElementById("commit-author").textContent = commit.author;
  document.getElementById("commit-lines").textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  document.getElementById("commit-tooltip").hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById("commit-tooltip");
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function selectedCommits(selection) {
  return selection ? commits.filter((d) => isCommitSelected(selection, d)) : [];
}

function renderSelectionCount(selection) {
  const count = selectedCommits(selection).length;
  document.querySelector("#selection-count").textContent =
    `${count || "No"} commits selected`;
}

function renderLanguageBreakdown(selection) {
  const selected = selectedCommits(selection);
  const container = document.getElementById("language-breakdown");
  container.innerHTML = "";
  if (selected.length === 0) return;

  const lines = selected.flatMap((d) => d.lines);
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  for (const [language, count] of breakdown) {
    const formatted = d3.format(".1~%")(count / lines.length);
    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll("circle").classed("selected", (d) =>
    isCommitSelected(selection, d),
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function renderScatterPlot(commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("overflow", "visible");

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();
  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([4, 30]);

  svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width));

  svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${usableArea.bottom})`)
    .call(d3.axisBottom(xScale));
  svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(
      d3
        .axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00"),
    );

  // largest dots first so small ones stay hoverable on top
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  svg
    .append("g")
    .attr("class", "dots")
    .selectAll("circle")
    .data(sortedCommits, (d) => d.id)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .style("fill-opacity", 0.7)
    .on("mouseenter", (event, commit) => {
      d3.select(event.currentTarget).style("fill-opacity", 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).style("fill-opacity", 0.7);
      updateTooltipVisibility(false);
    });

  svg.call(d3.brush().on("start brush end", brushed));
  // brush overlay swallows pointer events unless dots sit after it
  svg.selectAll(".dots, .overlay ~ *").raise();
}

function updateScatterPlot(commits) {
  const svg = d3.select("#chart").select("svg");

  xScale.domain(d3.extent(commits, (d) => d.datetime));

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([4, 30]);

  const xAxis = svg.select("g.x-axis");
  xAxis.selectAll("*").remove();
  xAxis.call(d3.axisBottom(xScale));

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  svg
    .select("g.dots")
    .selectAll("circle")
    .data(sortedCommits, (d) => d.id)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .style("fill-opacity", 0.7)
    .on("mouseenter", (event, commit) => {
      d3.select(event.currentTarget).style("fill-opacity", 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).style("fill-opacity", 0.7);
      updateTooltipVisibility(false);
    })
    .order();
}

function updateVisualization(maxTime) {
  commitMaxTime = maxTime;
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  updateScatterPlot(filteredCommits);
  updateFileDisplay(filteredCommits);
}

function onTimeSliderChange() {
  commitProgress = Number(document.getElementById("commit-progress").value);
  const maxTime = timeScale.invert(commitProgress);
  document.getElementById("commit-progress-time").textContent =
    maxTime.toLocaleString("en", { dateStyle: "long", timeStyle: "short" });
  updateVisualization(maxTime);
}

function updateFileDisplay(filteredCommits) {
  const lines = filteredCommits.flatMap((d) => d.lines);
  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3
    .select("#files")
    .selectAll("div")
    .data(files, (d) => d.name)
    .join((enter) =>
      enter.append("div").call((div) => {
        const dt = div.append("dt");
        dt.append("code");
        dt.append("small");
        div.append("dd");
      }),
    );

  filesContainer.select("dt > code").text((d) => d.name);
  filesContainer.select("dt > small").text((d) => `${d.lines.length} lines`);
  filesContainer
    .select("dd")
    .selectAll("div")
    .data((d) => d.lines)
    .join("div")
    .attr("class", "loc")
    .attr("style", (d) => `--color: ${colors(d.type)}`);
}

function onStepEnter(response) {
  updateVisualization(response.element.__data__.datetime);
}

const data = await loadData();
commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(commits);

const timeScale = d3
  .scaleTime()
  .domain(d3.extent(commits, (d) => d.datetime))
  .range([0, 100]);

document
  .getElementById("commit-progress")
  .addEventListener("input", onTimeSliderChange);
onTimeSliderChange();

d3.select("#scatter-story")
  .selectAll(".step")
  .data(commits)
  .join("div")
  .attr("class", "step")
  .html(
    (d, i) => `
      On ${d.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })},
      I made <a href="${d.url}" target="_blank">${
        i > 0 ? "another glorious commit" : "my first commit, and it was glorious"
      }</a>.
      I edited ${d.totalLines} lines across ${
        d3.rollups(d.lines, (v) => v.length, (d) => d.file).length
      } files.
    `,
  );

const scroller = scrollama();
scroller
  .setup({ container: "#scrolly-1", step: "#scrolly-1 .step" })
  .onStepEnter(onStepEnter);
