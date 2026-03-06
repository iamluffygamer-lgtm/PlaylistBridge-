export async function handler(event) {

  try {

    const body = JSON.parse(event.body);

    const response = await fetch("https://script.google.com/macros/s/AKfycbxrvZVI0uc3PmPYlHZoSRnGLjJyqxACuJAH8Ndn16W5csZTVk97-O1kgKiYia5AjjFRRA/exec", {
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

