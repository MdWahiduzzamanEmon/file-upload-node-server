document.getElementById("fileInput").addEventListener("change", function () {
  const file = this.files[0];
  const fileDetails = document.getElementById("fileDetails");

  if (file) {
    const fileSize = (file.size / (1024 * 1024)).toFixed(2); // Size in MB
    fileDetails.textContent = `Selected File: ${file.name} (${fileSize} MB)`;
  } else {
    fileDetails.textContent = "No file selected";
  }
});

document.getElementById("uploadBtn").addEventListener("click", () => {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  console.log("File:", file);
  const uploadBtn = document.getElementById("uploadBtn");

  if (!file) {
    alert("Please select a file to upload.");
    return;
  }

  // Disable the upload button to prevent multiple uploads
  uploadBtn.disabled = true;

  const formData = new FormData();
  formData.append("file", file);

  const progressContainer = document.getElementById("progressContainer");
  const progressBar = document.getElementById("progressBar").firstElementChild;
  const progressText = document.getElementById("progressText");
  const downloadDiv = document.getElementById("downloadLink");

  // Reset UI
  progressContainer.style.display = "block";
  progressBar.style.width = "0%";
  progressText.textContent = "0%";
  downloadDiv.innerHTML = "";

  axios
    .post("/uploadFile", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: function (progressEvent) {
        if (progressEvent.lengthComputable) {
          const percentComplete = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          progressBar.style.width = percentComplete + "%";
          progressText.textContent = percentComplete + "%";
        }
      },
    })
    .then((response) => {
      console.log("Upload successful:", response.data);
      const { fileUrl } = response.data;
      downloadDiv.innerHTML = `<a href="${fileUrl}" target="_blank" class="download-link">Download APK</a>`;
    })
    .catch((error) => {
      console.error("Upload failed:", error);
      const errorMsg =
        error.response && error.response.data && error.response.data.error
          ? error.response.data.error
          : "File upload failed. Please try again.";
      alert(`Upload failed: ${errorMsg}`);
    })
    .finally(() => {
      // Re-enable the upload button
      uploadBtn.disabled = false;
    });
});
