(async function () {
  const info = await SDPIComponents.streamDeckClient.getConnectionInfo();
  console.log("[HTML] Connection info:", info);
})();
