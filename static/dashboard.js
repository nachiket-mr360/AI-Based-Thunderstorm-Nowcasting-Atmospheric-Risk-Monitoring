/* ==========================================================================
   SIH 2026 dashboard front-end.
   Vanilla JavaScript, no build step. Talks only to the existing Flask API:
     GET /api/prediction   live weather + model inference (source of truth)
     GET /api/history      latest available real hourly atmospheric data (trend charts)
     GET /api/evaluation   Phase 1 metrics + feature importance (read-only)
     GET /api/health       model status
   No prediction value is computed or defaulted in the browser, and nothing is
   persisted to storage.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------- config -------------------------------- */

  var CONDITION_FIELDS = [
    { key: "temperature_2m", label: "Temperature" },
    { key: "relative_humidity_2m", label: "Relative Humidity" },
    { key: "surface_pressure", label: "Surface Pressure" },
    { key: "wind_speed_10m", label: "Wind Speed" },
    { key: "wind_direction_10m", label: "Wind Direction" },
    { key: "precipitation", label: "Precipitation" },
    { key: "cloud_cover", label: "Cloud Cover" }
  ];

  var METRIC_FIELDS = [
    { key: "accuracy", label: "Accuracy", digits: 4 },
    { key: "precision", label: "Precision", digits: 4 },
    { key: "recall", label: "Recall", digits: 4 },
    { key: "f1_score", label: "F1-score", digits: 4 },
    { key: "roc_auc", label: "ROC-AUC", digits: 4 }
  ];

  var TOP_FEATURES = 15;
  var COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                 "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

  var EMPTY = "\u2014";

  /* ------------------------------ tiny helpers --------------------------- */

  function el(id) { return document.getElementById(id); }

  function setText(id, value) {
    var node = el(id);
    if (node) { node.textContent = value; }
  }

  function isNum(value) {
    return typeof value === "number" && isFinite(value);
  }

  function oneDecimal(value) {
    return isNum(value) ? value.toFixed(1) : null;
  }

  function compassPoint(degrees) {
    if (!isNum(degrees)) { return ""; }
    var index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
    return COMPASS[index];
  }

  function formatUtc(iso) {
    if (!iso) { return EMPTY; }
    var date = new Date(iso);
    if (isNaN(date.getTime())) { return String(iso); }
    return date.toISOString().replace("T", " ").replace("Z", "").replace(".000", "");
  }

  function formatHourTick(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) { return iso; }
    return String(date.getUTCHours()).padStart(2, "0") + ":00";
  }

  /* --------------------------------- API ---------------------------------- */

  var Api = {
    get: function (path) {
      return fetch(path, { headers: { Accept: "application/json" } })
        .then(function (response) {
          return response.json()
            .catch(function () { return null; })
            .then(function (data) { return { ok: response.ok, status: response.status, data: data }; });
        })
        .catch(function (error) {
          return { ok: false, status: 0, data: null, networkError: String(error) };
        });
    }
  };

  /* ------------------------------ status / errors ------------------------- */

  function setStatus(state) {
    var pill = el("live-status");
    var text = el("live-status-text");
    if (!pill || !text) { return; }
    pill.className = "status-pill " + ({
      pending: "status-pending",
      live: "status-live",
      error: "status-error"
    }[state] || "status-pending");
    text.textContent = { pending: "Connecting\u2026", live: "Live Data", error: "Data Unavailable" }[state] || "";
  }

  function showError(message, detail) {
    var banner = el("error-banner");
    if (!banner) { return; }
    setText("error-detail", detail || "");
    var detailNode = el("error-detail");
    if (detailNode) { detailNode.hidden = !detail; }
    banner.querySelector(".error-banner-head strong").textContent = message;
    banner.hidden = false;
  }

  function hideError() {
    var banner = el("error-banner");
    if (banner) { banner.hidden = true; }
  }

  function describeFailure(result) {
    if (result.networkError) {
      return { message: "Live weather data is temporarily unavailable. No prediction was generated.",
               detail: "Could not reach the prediction API: " + result.networkError };
    }
    var data = result.data || {};
    if (data.error) {
      return {
        message: "Live weather data is temporarily unavailable. No prediction was generated.",
        detail: "Backend reported " + (data.code || "an error") + ": " + (data.message || "no detail") +
                (data.detail ? " (" + JSON.stringify(data.detail) + ")" : "")
      };
    }
    return {
      message: "Live weather data is temporarily unavailable. No prediction was generated.",
      detail: "Unexpected response (HTTP " + result.status + ")."
    };
  }

  /* ---------------------------- risk card rendering ----------------------- */

  /** Blank every live value so a failed refresh can never leave stale numbers
      on screen looking freshly fetched. */
  function clearLiveValues() {
    var label = el("risk-label");
    if (label) {
      label.textContent = EMPTY;
      label.className = "risk-label risk-label-empty";
    }
    var card = document.querySelector(".risk-card");
    if (card) { card.className = "card risk-card"; }

    setText("probability", EMPTY);
    setText("observation-timestamp", EMPTY);
    setText("threshold", EMPTY);
    var bar = el("probability-bar");
    if (bar) { bar.style.width = "0%"; }

    var grid = el("conditions-grid");
    if (grid) { grid.innerHTML = ""; }
    setText("conditions-note", "Awaiting live data\u2026");
  }

  function renderRisk(data) {
    var label = el("risk-label");
    var elevated = data.predicted_class === 1;

    if (label) {
      label.textContent = data.risk_label || EMPTY;
      label.className = "risk-label " + (elevated ? "risk-label-elevated" : "risk-label-low");
    }

    var card = document.querySelector(".risk-card");
    if (card) {
      card.className = "card risk-card " + (elevated ? "is-elevated" : "is-low");
    }

    setText("probability", isNum(data.probability) ? (data.probability * 100).toFixed(2) + "%" : EMPTY);
    var bar = el("probability-bar");
    if (bar && isNum(data.probability)) {
      bar.style.width = Math.max(0, Math.min(100, data.probability * 100)).toFixed(2) + "%";
    }

    setText("observation-timestamp", formatUtc(data.observation_timestamp_utc));

    var model = data.model || {};
    setText("threshold", isNum(model.decision_threshold_mm_per_3h)
      ? model.decision_threshold_mm_per_3h + " mm / 3 h"
      : EMPTY);
  }

  function renderConditions(data) {
    var grid = el("conditions-grid");
    if (!grid) { return; }
    grid.innerHTML = "";

    var weather = data.current_weather || {};
    CONDITION_FIELDS.forEach(function (field) {
      var entry = weather[field.key] || {};
      var wrapper = document.createElement("div");
      wrapper.className = "condition";

      var name = document.createElement("span");
      name.className = "condition-name";
      name.textContent = field.label;

      var value = document.createElement("span");
      value.className = "condition-value";
      var formatted = oneDecimal(entry.value);
      value.textContent = formatted === null ? EMPTY : formatted;

      if (formatted !== null) {
        var unit = document.createElement("span");
        unit.className = "condition-unit";
        unit.textContent = (entry.unit || "") +
          (field.key === "wind_direction_10m" ? " " + compassPoint(entry.value) : "");
        value.appendChild(unit);
      }

      wrapper.appendChild(name);
      wrapper.appendChild(value);
      grid.appendChild(wrapper);
    });

    setText("conditions-note", "Data timestamp " + formatUtc(data.observation_timestamp_utc) + " UTC");
  }

  /* --------------------------------- map ---------------------------------- */

  function initMap() {
    var container = el("map");
    if (!container) { return; }

    var latitude = parseFloat(container.dataset.latitude);
    var longitude = parseFloat(container.dataset.longitude);
    var locationName = container.dataset.location || "Target location";

    if (typeof L === "undefined") {
      container.innerHTML = '<div class="map-fallback">Map library unavailable (offline?). ' +
        'Target location: ' + locationName + " \u2014 " + latitude + "\u00b0 N, " + longitude + "\u00b0 E.</div>";
      return;
    }

    var map = L.map(container, {
      center: [latitude, longitude],
      zoom: 11,
      scrollWheelZoom: false
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Approximate locator circle only - explicitly not a forecast grid.
    L.circle([latitude, longitude], {
      radius: 9000,
      color: "#0b5c96",
      weight: 2,
      fillColor: "#1273b8",
      fillOpacity: 0.14
    }).addTo(map);

    var marker = L.marker([latitude, longitude]).addTo(map);
    marker.bindPopup(
      "<strong>Target Observation Location</strong><br>" + locationName +
      "<br>" + latitude + "\u00b0 N, " + longitude + "\u00b0 E"
    ).openPopup();

    marker.bindTooltip("Target Observation Location", { permanent: false });
  }

  /* -------------------------------- charts -------------------------------- */

  var chartState = { temperature: null, precipitation: null };

  function chartLibraryAvailable() {
    return typeof Chart !== "undefined";
  }

  function noteTrend(message) {
    var note = el("trend-note");
    if (note) {
      note.textContent = message;
      note.hidden = false;
    }
  }

  function clearTrendNote() {
    var note = el("trend-note");
    if (note) { note.hidden = true; }
  }

  function renderTrends(data) {
    if (!chartLibraryAvailable()) {
      noteTrend("Chart library could not be loaded (offline?). The live atmospheric data " +
                "remains available through GET /api/history.");
      return;
    }
    var hours = (data && data.hours) || [];
    if (!hours.length) {
      noteTrend("No recent hourly atmospheric data was returned, so no trend is plotted.");
      return;
    }
    clearTrendNote();

    var labels = hours.map(function (hour) { return formatHourTick(hour.timestamp_utc); });
    var temperatures = hours.map(function (hour) { return isNum(hour.temperature_2m) ? hour.temperature_2m : null; });
    var humidities = hours.map(function (hour) { return isNum(hour.relative_humidity_2m) ? hour.relative_humidity_2m : null; });
    var precipitation = hours.map(function (hour) { return isNum(hour.precipitation) ? hour.precipitation : null; });
    var units = data.units || {};

    setText("trend-window", hours.length + " hours · " + formatUtc(data.window_start_utc) +
      " to " + formatUtc(data.window_end_utc) + " UTC");

    if (chartState.temperature) { chartState.temperature.destroy(); }
    if (chartState.precipitation) { chartState.precipitation.destroy(); }

    chartState.temperature = new Chart(el("trend-chart"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Temperature (" + (units.temperature_2m || "\u00b0C") + ")",
            data: temperatures,
            borderColor: "#c9453c",
            backgroundColor: "rgba(201, 69, 60, 0.12)",
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.25,
            spanGaps: false,
            yAxisID: "y"
          },
          {
            label: "Relative Humidity (" + (units.relative_humidity_2m || "%") + ")",
            data: humidities,
            borderColor: "#1273b8",
            backgroundColor: "rgba(18, 115, 184, 0.10)",
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.25,
            spanGaps: false,
            yAxisID: "y1"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              title: function (items) {
                var index = items[0].dataIndex;
                return formatUtc(hours[index].timestamp_utc) + " UTC";
              }
            }
          }
        },
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 10 } },
               grid: { display: false } },
          y: { position: "left", title: { display: true, text: "°C", font: { size: 10 } },
               ticks: { font: { size: 10 } } },
          y1: { position: "right", suggestedMin: 0, suggestedMax: 100,
                title: { display: true, text: "%", font: { size: 10 } },
                ticks: { font: { size: 10 } }, grid: { display: false } }
        }
      }
    });

    chartState.precipitation = new Chart(el("precip-chart"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Precipitation (" + (units.precipitation || "mm") + ")",
          data: precipitation,
          backgroundColor: "#2f8f5f",
          borderWidth: 0,
          barPercentage: 0.9,
          categoryPercentage: 0.95
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              title: function (items) {
                var index = items[0].dataIndex;
                return formatUtc(hours[index].timestamp_utc) + " UTC";
              }
            }
          }
        },
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 10 } },
               grid: { display: false } },
          y: { beginAtZero: true, title: { display: true, text: "mm", font: { size: 10 } },
               ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  /* ------------------------- evaluation + importance ---------------------- */

  function renderEvaluation(data) {
    setText("evaluation-title", data.section_title || el("evaluation-title").textContent);
    setText("metrics-note", data.caveat || "");

    var metrics = data.metrics || {};
    var grid = el("metrics-grid");
    if (grid) {
      grid.innerHTML = "";
      METRIC_FIELDS.forEach(function (field) {
        var card = document.createElement("div");
        card.className = "metric-card";

        var name = document.createElement("span");
        name.className = "metric-name";
        name.textContent = field.label;

        var value = document.createElement("span");
        value.className = "metric-value-lg";
        value.textContent = isNum(metrics[field.key]) ? metrics[field.key].toFixed(field.digits) : EMPTY;

        card.appendChild(name);
        card.appendChild(value);
        grid.appendChild(card);
      });

      var samples = document.createElement("div");
      samples.className = "metric-card";
      var sname = document.createElement("span");
      sname.className = "metric-name";
      sname.textContent = "Test samples";
      var svalue = document.createElement("span");
      svalue.className = "metric-value-lg";
      svalue.textContent = isNum(metrics.n_samples) ? metrics.n_samples.toLocaleString() : EMPTY;
      samples.appendChild(sname);
      samples.appendChild(svalue);
      grid.appendChild(samples);
    }

    var sources = data.sources || {};
    setText("metrics-source", "Values read directly from " + (sources.evaluation || "outputs/evaluation.json") +
      " as generated in Phase 1. Nothing is recomputed or rounded here.");

    // Confusion matrix image (unmodified Phase 1 artifact) + numeric decode.
    var image = el("confusion-image");
    var matrix = data.confusion_matrix || {};
    if (image && matrix.image_url) {
      image.src = matrix.image_url;
    }

    var decoded = el("matrix-decode");
    if (decoded && Array.isArray(matrix.matrix) && matrix.matrix.length === 2) {
      var labels = matrix.labels || ["Low Risk", "Elevated Risk"];
      var tn = matrix.matrix[0][0], fp = matrix.matrix[0][1];
      var fn = matrix.matrix[1][0], tp = matrix.matrix[1][1];
      var total = isNum(metrics.n_samples) ? metrics.n_samples.toLocaleString() : (tn + fp + fn + tp);
      decoded.textContent =
        "Test set (" + total + " samples): " +
        tn.toLocaleString() + " correctly " + labels[0] + "; " +
        fp.toLocaleString() + " " + labels[0] + " predicted " + labels[1] + "; " +
        fn.toLocaleString() + " " + labels[1] + " missed; " +
        tp.toLocaleString() + " correctly " + labels[1] + ".";
    }
  }

  function renderImportance(data) {
    var list = el("importance-list");
    if (!list) { return; }

    var rows = (data.feature_importance || []).slice();
    if (!rows.length) {
      list.innerHTML = "";
      setText("importance-source", "No feature importance values were returned.");
      return;
    }

    rows.sort(function (a, b) { return b.importance - a.importance; });
    var top = rows.slice(0, TOP_FEATURES);
    var max = top[0].importance || 1;

    list.innerHTML = "";
    top.forEach(function (row) {
      var wrapper = document.createElement("div");
      wrapper.className = "importance-row";

      var name = document.createElement("span");
      name.className = "importance-name";
      name.textContent = row.feature;
      name.title = row.feature;

      var track = document.createElement("div");
      track.className = "importance-track";
      var fill = document.createElement("div");
      fill.className = "importance-fill";
      fill.style.width = Math.max(0, (row.importance / max) * 100).toFixed(1) + "%";
      track.appendChild(fill);

      var value = document.createElement("span");
      value.className = "importance-value";
      value.textContent = isNum(row.importance) ? row.importance.toFixed(4) : EMPTY;

      wrapper.appendChild(name);
      wrapper.appendChild(track);
      wrapper.appendChild(value);
      list.appendChild(wrapper);
    });

    var sources = data.sources || {};
    setText("importance-source", "Top " + top.length + " of " + rows.length +
      " predictors, read directly from " + (sources.feature_importance || "outputs/feature_importance.csv") +
      ". Values are the Random Forest importances produced in Phase 1.");
  }

  /* ------------------- historical scenario demonstration ------------------ */

  var scenarioRun = false;

  function setScenarioBusy(busy) {
    var button = el("scenario-button");
    if (!button) { return; }
    button.disabled = busy;
    button.textContent = busy ? "Running\u2026" : (scenarioRun ? "Run Historical Scenario Again" : "Run Historical Scenario");
  }

  function showScenarioError(message) {
    var box = el("scenario-error");
    if (!box) { return; }
    box.textContent = message;
    box.hidden = false;
    var result = el("scenario-result");
    if (result) { result.hidden = true; }
  }

  function hideScenarioError() {
    var box = el("scenario-error");
    if (box) { box.hidden = true; }
  }

  function fillTable(id, rows) {
    var body = el(id);
    if (!body) { return; }
    body.innerHTML = "";
    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      var label = document.createElement("td");
      label.textContent = row.label;
      var value = document.createElement("td");
      value.textContent = row.value;
      tr.appendChild(label);
      tr.appendChild(value);
      body.appendChild(tr);
    });
  }

  function humaniseFeature(name) {
    return name.replace(/_/g, " ");
  }

  function renderScenario(data) {
    scenarioRun = true;
    hideScenarioError();

    setText("scenario-timestamp", formatUtc(data.historical_timestamp) + " UTC");

    var elevated = data.predicted_class === 1;
    var labelNode = el("scenario-label");
    if (labelNode) {
      labelNode.textContent = data.risk_label || EMPTY;
      labelNode.className = "scenario-label " + (elevated ? "scenario-label-elevated" : "scenario-label-low");
    }

    setText("scenario-probability", isNum(data.probability) ? (data.probability * 100).toFixed(2) + "%" : EMPTY);
    var bar = el("scenario-probability-bar");
    if (bar && isNum(data.probability)) {
      bar.style.width = Math.max(0, Math.min(100, data.probability * 100)).toFixed(2) + "%";
    }

    // Historical atmospheric inputs, exactly as recorded at that timestamp.
    var conditions = data.input_atmospheric_conditions || {};
    fillTable("scenario-inputs", CONDITION_FIELDS.map(function (field) {
      var entry = conditions[field.key] || {};
      var shown = oneDecimal(entry.value);
      return {
        label: field.label,
        value: (shown === null ? EMPTY : shown + " " + (entry.unit || "")).trim()
      };
    }));

    var lags = data.historical_lag_and_rolling_features || {};
    fillTable("scenario-lags", Object.keys(lags).map(function (name) {
      return { label: humaniseFeature(name), value: isNum(lags[name]) ? lags[name].toFixed(4) : EMPTY };
    }));

    // Observed outcome, rendered in a separate block from the prediction.
    var outcome = data.actual_proxy_outcome || {};
    var precip = el("scenario-future-precip");
    if (precip) {
      precip.textContent = isNum(outcome.future_precip_3h)
        ? outcome.future_precip_3h.toFixed(1) + " mm / 3 h"
        : EMPTY;
    }

    var actualNode = el("scenario-actual-label");
    if (actualNode) {
      actualNode.textContent = outcome.actual_label || EMPTY;
      actualNode.className = "stat-value stat-value-sm " +
        (outcome.actual_class === 1 ? "text-elevated" : "text-low");
    }

    var noteParts = [];
    if (outcome.definition) { noteParts.push(outcome.definition); }
    if (isNum(outcome.threshold_mm_per_3h)) {
      noteParts.push("Threshold: " + outcome.threshold_mm_per_3h + " mm / 3 h (training-only 90th percentile).");
    }
    if (outcome.note) { noteParts.push(outcome.note); }
    setText("scenario-outcome-note", noteParts.join(" "));

    var leakOk = data.future_values_used_for_prediction === false &&
                 data.future_precip_3h_is_input_feature === false;
    setText("scenario-leak-strip", leakOk
      ? "future_values_used_for_prediction: false \u2014 the next-3-hour precipitation was not used as a model input."
      : "Warning: the response reports future values in the prediction path. Do not present this scenario.");

    setText("scenario-explanation", data.explanation || "");
    setText("scenario-caveat", data.scenario_caveat || "");

    var result = el("scenario-result");
    if (result) { result.hidden = false; }
  }

  function runScenario() {
    setScenarioBusy(true);
    hideScenarioError();
    return Api.get("/api/scenario")
      .then(function (result) {
        if (result.ok && result.data && !result.data.error) {
          renderScenario(result.data);
        } else {
          var failure = describeFailure(result);
          showScenarioError("The historical scenario could not be loaded. " + failure.detail);
        }
      })
      .catch(function (error) {
        showScenarioError("The historical scenario could not be loaded. " + String(error));
      })
      .then(function () { setScenarioBusy(false); });
  }

  /* ------------------------------- loaders -------------------------------- */

  function setBusy(busy) {
    var button = el("refresh-button");
    if (!button) { return; }
    button.disabled = busy;
    button.textContent = busy ? "Refreshing\u2026" : "Refresh Prediction";
  }

  function loadStatic() {
    return Api.get("/api/evaluation").then(function (result) {
      if (result.ok && result.data && !result.data.error) {
        renderEvaluation(result.data);
        renderImportance(result.data);
      } else {
        var failure = describeFailure(result);
        setText("metrics-source", "Model evaluation could not be loaded. " + failure.detail);
        setText("importance-source", "Feature importance could not be loaded. " + failure.detail);
      }
    });
  }

  function loadLive() {
    setBusy(true);
    setStatus("pending");
    hideError();
    // Blank the cards before fetching so nothing stale is ever shown as current.
    clearLiveValues();

    return Api.get("/api/prediction")
      .then(function (prediction) {
        if (prediction.ok && prediction.data && !prediction.data.error) {
          renderRisk(prediction.data);
          renderConditions(prediction.data);
          setStatus("live");
        } else {
          var failure = describeFailure(prediction);
          setStatus("error");
          showError(failure.message, failure.detail);
        }
      })
      .then(function () {
        return Api.get("/api/history");
      })
      .then(function (history) {
        if (history.ok && history.data && !history.data.error) {
          renderTrends(history.data);
        } else {
          noteTrend("Recent hourly atmospheric data could not be loaded. " + describeFailure(history).detail);
        }
      })
      .then(function () { setBusy(false); })
      .catch(function (error) {
        setBusy(false);
        setStatus("error");
        showError("Live weather data is temporarily unavailable. No prediction was generated.", String(error));
      });
  }

  /* --------------------------------- init --------------------------------- */

  function init() {
    initMap();
    setStatus("pending");
    var button = el("refresh-button");
    if (button) {
      button.addEventListener("click", function () { loadLive(); });
    }

    // The historical scenario is deliberately NOT run on page load: it is a
    // demonstration the presenter triggers, and it must never replace live data.
    var scenarioButton = el("scenario-button");
    if (scenarioButton) {
      scenarioButton.addEventListener("click", function () { runScenario(); });
    }

    loadStatic();
    loadLive();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
