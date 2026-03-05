export async function handler(event) {

  try {

    const body = JSON.parse(event.body);

    const response = await fetch("https://script.google.com/macros/s/AKfycbwoiS0MLyFeZZkJkZwROi5rmNo8lIqUG_vLASMp9ZgsCWddkmwx4dgweNPeGyHFd2tZMA/exec", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ success: true })
    };

  } catch (error) {

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Feedback submission failed"
      })
    };

  }
}

